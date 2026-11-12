package com.aureus.aureus.service;

import com.aureus.aureus.dto.ReconciliationCheck;
import com.aureus.aureus.dto.ReconciliationResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class ReconciliationService {

    private static final Logger log =
            LoggerFactory.getLogger(ReconciliationService.class);

    private static final int MAX_OFFENDERS = 50;

    private static final String TRANSACTION_LEDGER_SQL = """
            /* CHECK_1_TRANSACTION_LEDGER */
            SELECT CAST(t.transaction_id AS CHAR) AS offender
            FROM `Transaction` t
            LEFT JOIN ledger_entry l
                ON l.transaction_id = t.transaction_id
            WHERE t.transaction_status = 'COMPLETED'
            GROUP BY t.transaction_id, t.amount
            HAVING COUNT(l.ledger_entry_id) <> 2
                OR SUM(CASE WHEN l.entry_type = 'DEBIT' THEN 1 ELSE 0 END) <> 1
                OR SUM(CASE WHEN l.entry_type = 'CREDIT' THEN 1 ELSE 0 END) <> 1
                OR COALESCE(SUM(CASE WHEN l.entry_type = 'DEBIT' THEN l.amount ELSE 0 END), 0) <> t.amount
                OR COALESCE(SUM(CASE WHEN l.entry_type = 'CREDIT' THEN l.amount ELSE 0 END), 0) <> t.amount
            ORDER BY t.transaction_id
            LIMIT 50
            """;

    private static final String LEDGER_TOTALS_SQL = """
            /* CHECK_2_LEDGER_TOTALS */
            SELECT
                COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount ELSE 0 END), 0) AS total_debits,
                COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE 0 END), 0) AS total_credits
            FROM ledger_entry
            """;

    private static final String ACCOUNT_BALANCE_SQL_TEMPLATE = """
            /* CHECK_3_ACCOUNT_BALANCES */
            SELECT CONCAT(
                'account_id=', CAST(r.account_id AS CHAR),
                ', type=', r.account_type,
                ', balance=', CAST(r.actual_balance AS CHAR),
                ', expected=', CAST(r.expected_balance AS CHAR)
            ) AS offender
            FROM (
                SELECT
                    a.account_id,
                    a.account_type,
                    a.balance AS actual_balance,
                    CASE
                        WHEN a.account_type = 'SYSTEM' THEN %s
                            - COALESCE(SUM(CASE WHEN l.entry_type = 'DEBIT' THEN l.amount ELSE 0 END), 0)
                            + COALESCE(SUM(CASE WHEN l.entry_type = 'CREDIT' THEN l.amount ELSE 0 END), 0)
                        ELSE
                            COALESCE(SUM(CASE WHEN l.entry_type = 'CREDIT' THEN l.amount ELSE 0 END), 0)
                            - COALESCE(SUM(CASE WHEN l.entry_type = 'DEBIT' THEN l.amount ELSE 0 END), 0)
                    END AS expected_balance
                FROM Account a
                LEFT JOIN ledger_entry l ON l.account_id = a.account_id
                GROUP BY a.account_id, a.account_type, a.balance
            ) r
            WHERE r.actual_balance <> r.expected_balance
            ORDER BY r.account_id
            LIMIT 50
            """;

    private static final String ACCOUNT_TOTAL_SQL = """
            /* CHECK_4_CONSERVATION */
            SELECT COALESCE(SUM(balance), 0) FROM Account
            """;

    private static final String REVERSAL_INTEGRITY_SQL = """
            /* CHECK_5_REVERSAL_INTEGRITY */
            SELECT CAST(t.transaction_id AS CHAR) AS offender
            FROM `Transaction` t
            LEFT JOIN `Transaction` original
                ON original.transaction_id = t.original_transaction_id
            WHERE
                (
                    t.transaction_type = 'REVERSAL'
                    AND (
                        t.original_transaction_id IS NULL
                        OR original.transaction_id IS NULL
                        OR original.transaction_status <> 'COMPLETED'
                        OR original.transaction_type NOT IN ('ADD_MONEY', 'WITHDRAWAL', 'TRANSFER')
                        OR t.transaction_status <> 'COMPLETED'
                        OR t.amount <> original.amount
                        OR t.sender_account_id <> original.receiver_account_id
                        OR t.receiver_account_id <> original.sender_account_id
                        OR t.idempotency_key <> CONCAT('REVERSAL-', original.transaction_id)
                    )
                )
                OR
                (
                    t.original_transaction_id IS NOT NULL
                    AND t.transaction_type <> 'REVERSAL'
                )
            ORDER BY t.transaction_id
            LIMIT 50
            """;

    private final JdbcTemplate jdbcTemplate;
    private final BigDecimal systemSeedBalance;

    public ReconciliationService(
            JdbcTemplate jdbcTemplate,
            @Value("${aureus.system.seed-balance:99999999.99}")
            BigDecimal systemSeedBalance) {
        this.jdbcTemplate = jdbcTemplate;
        this.systemSeedBalance = systemSeedBalance;
    }

    /*
     * All queries run inside one REPEATABLE_READ, read-only transaction.
     * This gives the report one consistent database snapshot even while
     * other requests are posting money concurrently.
     */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ReconciliationResponse runReconciliation(Integer adminUserId) {

        List<ReconciliationCheck> checks = new ArrayList<>();

        List<String> transactionOffenders = limited(
                jdbcTemplate.queryForList(TRANSACTION_LEDGER_SQL, String.class)
        );
        checks.add(check(
                "TRANSACTION_LEDGER_ENTRIES",
                transactionOffenders,
                "Every completed transaction must have exactly one matching DEBIT and one matching CREDIT ledger entry.",
                "Completed transactions with missing, duplicate or mismatched ledger entries: "
        ));

        Map<String, Object> ledgerTotals = jdbcTemplate.queryForMap(LEDGER_TOTALS_SQL);
        BigDecimal totalDebits = decimal(ledgerTotals.get("total_debits"));
        BigDecimal totalCredits = decimal(ledgerTotals.get("total_credits"));
        boolean ledgerTotalsMatch = totalDebits.compareTo(totalCredits) == 0;
        String ledgerTotalsDetails = "Total DEBIT=" + totalDebits.toPlainString()
                + "; total CREDIT=" + totalCredits.toPlainString();
        List<String> ledgerTotalsOffenders = ledgerTotalsMatch
                ? List.of()
                : List.of(ledgerTotalsDetails);
        checks.add(new ReconciliationCheck(
                "LEDGER_TOTALS",
                ledgerTotalsMatch,
                ledgerTotalsDetails,
                ledgerTotalsOffenders
        ));

        String accountBalanceSql = ACCOUNT_BALANCE_SQL_TEMPLATE.formatted(
                systemSeedBalance.toPlainString()
        );
        List<String> accountOffenders = new ArrayList<>(limited(
                jdbcTemplate.queryForList(accountBalanceSql, String.class)
        ));
        Integer systemAccountCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM Account WHERE account_type = 'SYSTEM'",
                Integer.class
        );
        if (systemAccountCount == null || systemAccountCount != 1) {
            accountOffenders.add("Expected exactly one SYSTEM account; found "
                    + (systemAccountCount == null ? "null" : systemAccountCount));
        }
        accountOffenders = limited(accountOffenders);
        checks.add(check(
                "ACCOUNT_BALANCES",
                accountOffenders,
                "Each non-SYSTEM balance must equal ledger credits minus debits; SYSTEM must equal seed minus debits plus credits, with exactly one SYSTEM account.",
                "Accounts inconsistent with their ledger-derived balance: "
        ));

        BigDecimal totalAccountBalances = jdbcTemplate.queryForObject(
                ACCOUNT_TOTAL_SQL,
                BigDecimal.class
        );
        if (totalAccountBalances == null) {
            totalAccountBalances = BigDecimal.ZERO;
        }
        boolean conserved = totalAccountBalances.compareTo(systemSeedBalance) == 0;
        String conservationDetails = "Sum of all account balances="
                + totalAccountBalances.toPlainString()
                + "; expected SYSTEM seed=" + systemSeedBalance.toPlainString();
        List<String> conservationOffenders = conserved
                ? List.of()
                : List.of(conservationDetails);
        checks.add(new ReconciliationCheck(
                "MONEY_CONSERVATION",
                conserved,
                conservationDetails,
                conservationOffenders
        ));

        List<String> reversalOffenders = limited(
                jdbcTemplate.queryForList(REVERSAL_INTEGRITY_SQL, String.class)
        );
        checks.add(check(
                "REVERSAL_INTEGRITY",
                reversalOffenders,
                "Every reversal must reference a completed reversible original, have the same amount, swap accounts and use its deterministic key.",
                "Invalid reversal transaction IDs: "
        ));

        String status = checks.stream().allMatch(ReconciliationCheck::isPassed)
                ? "OK"
                : "MISMATCH";

        log.info("ADMIN {} ran reconciliation: {}", adminUserId, status);

        return new ReconciliationResponse(
                status,
                LocalDateTime.now(),
                checks
        );
    }

    private ReconciliationCheck check(
            String name,
            List<String> offenders,
            String successDetails,
            String failurePrefix) {
        boolean passed = offenders.isEmpty();
        String details = passed
                ? successDetails
                : failurePrefix + String.join(", ", offenders);
        return new ReconciliationCheck(name, passed, details, offenders);
    }

    private List<String> limited(List<String> values) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        return values.stream().limit(MAX_OFFENDERS).toList();
    }

    private BigDecimal decimal(Object value) {
        if (value == null) {
            return BigDecimal.ZERO;
        }
        if (value instanceof BigDecimal bigDecimal) {
            return bigDecimal;
        }
        return new BigDecimal(value.toString());
    }
}