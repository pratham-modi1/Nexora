
package com.aureus.aureus.repository;

import com.aureus.aureus.entity.Account;
import com.aureus.aureus.entity.AccountType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface AccountRepository
        extends JpaRepository<Account, Integer> {

    List<Account> findByUserId(Integer userId);

    Optional<Account> findByUserIdAndAccountType(
            Integer userId,
            AccountType accountType
    );

    List<Account> findByAccountType(AccountType accountType);


    /*
     * Fetch account IDs without loading complete Account entities.
     */
    @Query("""
        SELECT a.accountId
        FROM Account a
        WHERE a.userId = :userId
          AND a.accountType = :accountType
        """)
    Optional<Integer> findAccountIdByUserIdAndType(
            @Param("userId") Integer userId,
            @Param("accountType") AccountType accountType
    );


    /*
     * Native SQL locking query.
     *
     * TiDB/MySQL-compatible FOR UPDATE syntax is used instead
     * of Hibernate's generated FOR UPDATE OF alias syntax.
     *
     * AccountType is stored using EnumType.STRING.
     */
    @Query(value = """
        SELECT *
        FROM account
        WHERE user_id = :userId
          AND account_type IN (:accountTypes)
        ORDER BY account_id ASC
        FOR UPDATE
        """, nativeQuery = true)
    List<Account> findCustomerAccountsForUpdateNative(
            @Param("userId") Integer userId,
            @Param("accountTypes") List<String> accountTypes
    );


    /*
     * Compatibility wrapper.
     *
     * Keeps the original method signature so
     * LedgerPostingService requires no modification.
     */
    default List<Account> findCustomerAccountsForUpdate(
            Integer userId,
            List<AccountType> accountTypes) {

        List<String> accountTypeNames = accountTypes.stream()
                .map(AccountType::name)
                .toList();

        return findCustomerAccountsForUpdateNative(
                userId,
                accountTypeNames
        );
    }


    /*
     * Conditional debit.
     *
     * Debit happens only when sufficient balance exists.
     */
    @Modifying(
        flushAutomatically = true,
        clearAutomatically = true
    )
    @Query("""
        UPDATE Account a
        SET a.balance = a.balance - :amount
        WHERE a.accountId = :accountId
          AND a.balance >= :amount
        """)
    int debitIfSufficientBalance(
            @Param("accountId") Integer accountId,
            @Param("amount") BigDecimal amount
    );


    /*
     * Locks two wallet accounts belonging to potentially
     * different users.
     *
     * Account IDs are acquired in ascending order to reduce
     * the possibility of deadlocks.
     */
    @Query(value = """
        SELECT *
        FROM account
        WHERE account_id IN (:accountIds)
        ORDER BY account_id ASC
        FOR UPDATE
        """, nativeQuery = true)
    List<Account> lockWalletAccountsByIdsOrdered(
            @Param("accountIds") List<Integer> accountIds
    );

}
