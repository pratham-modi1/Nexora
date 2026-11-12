package com.aureus.aureus.service;

import com.aureus.aureus.dto.MoneyResult;
import com.aureus.aureus.dto.SendMoneyResult;
import com.aureus.aureus.entity.Account;
import com.aureus.aureus.entity.AccountType;
import com.aureus.aureus.entity.LedgerEntry;
import com.aureus.aureus.entity.Role;
import com.aureus.aureus.entity.Transaction;
import com.aureus.aureus.entity.TransactionStatus;
import com.aureus.aureus.entity.TransactionType;
import com.aureus.aureus.entity.User;
import com.aureus.aureus.entity.UserStatus;
import com.aureus.aureus.exception.LimitExceededException;
import com.aureus.aureus.repository.AccountRepository;
import com.aureus.aureus.repository.LedgerEntryRepository;
import com.aureus.aureus.repository.TransactionRepository;
import com.aureus.aureus.repository.UserRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LedgerPostingServiceLimitsTest {

    private static final BigDecimal MAX_TRANSACTION =
            new BigDecimal("50000.00");

    private static final BigDecimal MAX_WALLET =
            new BigDecimal("100000.00");

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private TransactionRepository transactionRepository;

    @Mock
    private LedgerEntryRepository ledgerEntryRepository;

    @Mock
    private UserRepository userRepository;

    private LedgerPostingService postingService;

    @BeforeEach
    void setUp() {
        postingService = new LedgerPostingService(
                accountRepository,
                transactionRepository,
                ledgerEntryRepository,
                userRepository,
                MAX_TRANSACTION,
                MAX_WALLET
        );
    }

    @Test
    void addMoney_rejectsAmountAboveTransactionLimit_withoutChangingBalances() {
        Account bank = account(101, 1, AccountType.BANK, "200000.00");
        Account wallet = account(102, 1, AccountType.WALLET, "1000.00");
        prepareCustomerAccounts(1, bank, wallet);
        when(transactionRepository.findByIdempotencyKey("U1-key-amount"))
                .thenReturn(Optional.empty());

        LimitExceededException exception = assertThrows(
                LimitExceededException.class,
                () -> postingService.postMoneyMovement(
                        1,
                        new BigDecimal("50000.01"),
                        "key-amount",
                        TransactionType.ADD_MONEY
                )
        );

        assertEquals(
                "Transaction amount exceeds the maximum allowed amount",
                exception.getMessage()
        );
        assertMoney("200000.00", bank.getBalance());
        assertMoney("1000.00", wallet.getBalance());
        verify(transactionRepository, never()).saveAndFlush(any(Transaction.class));
        verifyNoInteractions(ledgerEntryRepository);
    }

    @Test
    void addMoney_rejectsProjectedWalletBalanceAboveCap_withoutChangingBalances() {
        Account bank = account(101, 1, AccountType.BANK, "200000.00");
        Account wallet = account(102, 1, AccountType.WALLET, "99900.00");
        prepareCustomerAccounts(1, bank, wallet);
        when(transactionRepository.findByIdempotencyKey("U1-key-wallet-cap"))
                .thenReturn(Optional.empty());

        LimitExceededException exception = assertThrows(
                LimitExceededException.class,
                () -> postingService.postMoneyMovement(
                        1,
                        new BigDecimal("200.00"),
                        "key-wallet-cap",
                        TransactionType.ADD_MONEY
                )
        );

        assertEquals("Wallet balance limit would be exceeded", exception.getMessage());
        assertMoney("200000.00", bank.getBalance());
        assertMoney("99900.00", wallet.getBalance());
        verify(transactionRepository, never()).saveAndFlush(any(Transaction.class));
        verifyNoInteractions(ledgerEntryRepository);
    }

    @Test
    void sendMoney_usesGenericMessageWhenRecipientWalletWouldExceedCap() {
        Account senderWallet = account(201, 1, AccountType.WALLET, "1000.00");
        Account recipientWallet = account(202, 2, AccountType.WALLET, "99950.00");

        when(accountRepository.lockWalletAccountsByIdsOrdered(anyList()))
                .thenReturn(List.of(senderWallet, recipientWallet));
        when(userRepository.findById(1)).thenReturn(Optional.of(activeUser("sender@test.com")));
        when(userRepository.findById(2)).thenReturn(Optional.of(activeUser("recipient@test.com")));
        when(transactionRepository.findByIdempotencyKey("U1-key-recipient-cap"))
                .thenReturn(Optional.empty());

        LimitExceededException exception = assertThrows(
                LimitExceededException.class,
                () -> postingService.postTransfer(
                        1,
                        201,
                        2,
                        202,
                        "recipient@test.com",
                        new BigDecimal("100.00"),
                        "key-recipient-cap"
                )
        );

        assertEquals("Recipient cannot receive this amount", exception.getMessage());
        assertMoney("1000.00", senderWallet.getBalance());
        assertMoney("99950.00", recipientWallet.getBalance());
        verify(transactionRepository, never()).saveAndFlush(any(Transaction.class));
        verifyNoInteractions(ledgerEntryRepository);
    }

    @Test
    void sendMoney_rejectsTransactionAmountAboveLimit() {
        Account senderWallet = account(201, 1, AccountType.WALLET, "100000.00");
        Account recipientWallet = account(202, 2, AccountType.WALLET, "100.00");

        when(accountRepository.lockWalletAccountsByIdsOrdered(anyList()))
                .thenReturn(List.of(senderWallet, recipientWallet));
        when(userRepository.findById(1)).thenReturn(Optional.of(activeUser("sender@test.com")));
        when(userRepository.findById(2)).thenReturn(Optional.of(activeUser("recipient@test.com")));
        when(transactionRepository.findByIdempotencyKey("U1-key-send-amount"))
                .thenReturn(Optional.empty());

        LimitExceededException exception = assertThrows(
                LimitExceededException.class,
                () -> postingService.postTransfer(
                        1,
                        201,
                        2,
                        202,
                        "recipient@test.com",
                        new BigDecimal("50000.01"),
                        "key-send-amount"
                )
        );

        assertEquals(
                "Transaction amount exceeds the maximum allowed amount",
                exception.getMessage()
        );
        assertMoney("100000.00", senderWallet.getBalance());
        assertMoney("100.00", recipientWallet.getBalance());
        verify(transactionRepository, never()).saveAndFlush(any(Transaction.class));
        verifyNoInteractions(ledgerEntryRepository);
    }

    @Test
    void sendMoney_replaysPriorSuccessBeforeApplyingNewLimits() {
        Account senderWallet = account(201, 1, AccountType.WALLET, "500.00");
        Account recipientWallet = account(202, 2, AccountType.WALLET, "1000.00");
        Transaction previous = new Transaction(
                201,
                202,
                new BigDecimal("60000.00"),
                TransactionType.TRANSFER,
                TransactionStatus.COMPLETED,
                "U1-key-replay",
                null
        );

        when(accountRepository.lockWalletAccountsByIdsOrdered(anyList()))
                .thenReturn(List.of(senderWallet, recipientWallet));
        when(userRepository.findById(1)).thenReturn(Optional.of(activeUser("sender@test.com")));
        when(userRepository.findById(2)).thenReturn(Optional.of(activeUser("recipient@test.com")));
        when(transactionRepository.findByIdempotencyKey("U1-key-replay"))
                .thenReturn(Optional.of(previous));

        SendMoneyResult result = postingService.postTransfer(
                1,
                201,
                2,
                202,
                "recipient@test.com",
                new BigDecimal("60000.00"),
                "key-replay"
        );

        assertTrue(result.isReplayed());
        assertMoney("500.00", senderWallet.getBalance());
        assertMoney("1000.00", recipientWallet.getBalance());
        verify(transactionRepository, never()).saveAndFlush(any(Transaction.class));
        verifyNoInteractions(ledgerEntryRepository);
    }

    @Test
    void withdrawal_toBank_isNotSubjectToWalletDestinationBalanceCap() {
        Account bank = account(101, 1, AccountType.BANK, "99999.00");
        Account wallet = account(102, 1, AccountType.WALLET, "1000.00");
        prepareCustomerAccounts(1, bank, wallet);
        when(transactionRepository.findByIdempotencyKey("U1-key-withdrawal"))
                .thenReturn(Optional.empty());
        when(transactionRepository.saveAndFlush(any(Transaction.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        MoneyResult result = postingService.postMoneyMovement(
                1,
                new BigDecimal("100.00"),
                "key-withdrawal",
                TransactionType.WITHDRAWAL
        );

        assertFalse(result.isReplayed());
        assertMoney("100099.00", bank.getBalance());
        assertMoney("900.00", wallet.getBalance());
        verify(transactionRepository).saveAndFlush(any(Transaction.class));
        verify(ledgerEntryRepository, org.mockito.Mockito.times(2))
                .save(any(LedgerEntry.class));
    }

    private void prepareCustomerAccounts(
            Integer userId,
            Account bank,
            Account wallet) {

        when(accountRepository.findCustomerAccountsForUpdate(eq(userId), anyList()))
                .thenReturn(List.of(bank, wallet));
        when(userRepository.findById(userId))
                .thenReturn(Optional.of(activeUser("user" + userId + "@test.com")));
    }

    private Account account(
            Integer accountId,
            Integer userId,
            AccountType type,
            String balance) {

        Account account = new Account(
                userId,
                type,
                new BigDecimal(balance)
        );

        ReflectionTestUtils.setField(account, "accountId", accountId);
        return account;
    }

    private User activeUser(String email) {
        return new User(
                email,
                "not-a-real-password-hash",
                Role.USER,
                UserStatus.ACTIVE
        );
    }

    private void assertMoney(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual));
    }
}
