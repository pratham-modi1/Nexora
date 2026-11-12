package com.aureus.aureus.service;

import com.aureus.aureus.dto.ReversalResponse;
import com.aureus.aureus.entity.Account;
import com.aureus.aureus.entity.AccountType;
import com.aureus.aureus.entity.EntryType;
import com.aureus.aureus.entity.LedgerEntry;
import com.aureus.aureus.entity.Transaction;
import com.aureus.aureus.entity.TransactionStatus;
import com.aureus.aureus.entity.TransactionType;
import com.aureus.aureus.exception.AlreadyReversedException;
import com.aureus.aureus.exception.InsufficientFundsException;
import com.aureus.aureus.repository.AccountRepository;
import com.aureus.aureus.repository.LedgerEntryRepository;
import com.aureus.aureus.repository.TransactionRepository;
import com.aureus.aureus.repository.UserRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LedgerPostingServiceReversalTest {

    @Mock private AccountRepository accountRepository;
    @Mock private TransactionRepository transactionRepository;
    @Mock private LedgerEntryRepository ledgerEntryRepository;
    @Mock private UserRepository userRepository;

    private LedgerPostingService ledgerPostingService;

    @BeforeEach
    void setUp() {
        ledgerPostingService = new LedgerPostingService(
                accountRepository,
                transactionRepository,
                ledgerEntryRepository,
                userRepository,
                new BigDecimal("50000.00"),
                new BigDecimal("100000.00")
        );
    }

    @Test
    void reversal_swapsAccountsAndBalancesAndWritesBalancedLedgerEntries() {
        Account originalSender = account(10, AccountType.BANK, "4000.00");
        Account originalReceiver = account(20, AccountType.WALLET, "300.00");
        Transaction original = originalTransaction(
                77, 10, 20, "100.00", TransactionType.ADD_MONEY);

        when(accountRepository.lockWalletAccountsByIdsOrdered(List.of(10, 20)))
                .thenReturn(List.of(originalSender, originalReceiver));
        when(transactionRepository.existsByOriginalTransactionId(77)).thenReturn(false);
        when(transactionRepository.findByIdempotencyKey("REVERSAL-77"))
                .thenReturn(Optional.empty());
        when(transactionRepository.saveAndFlush(any(Transaction.class)))
                .thenAnswer(invocation -> {
                    Transaction saved = invocation.getArgument(0);
                    ReflectionTestUtils.setField(saved, "transactionId", 900);
                    return saved;
                });

        ReversalResponse response = ledgerPostingService.postReversal(original, 5);

        assertEquals(900, response.getReversalTransactionId());
        assertEquals(77, response.getOriginalTransactionId());
        assertEquals(0, new BigDecimal("100.00").compareTo(response.getAmount()));
        assertEquals(TransactionStatus.COMPLETED, response.getStatus());
        assertEquals(0, new BigDecimal("4100.00").compareTo(originalSender.getBalance()));
        assertEquals(0, new BigDecimal("200.00").compareTo(originalReceiver.getBalance()));

        ArgumentCaptor<Transaction> transactionCaptor =
                ArgumentCaptor.forClass(Transaction.class);
        verify(transactionRepository).saveAndFlush(transactionCaptor.capture());
        Transaction reversal = transactionCaptor.getValue();
        assertEquals(20, reversal.getSenderAccountId());
        assertEquals(10, reversal.getReceiverAccountId());
        assertEquals(TransactionType.REVERSAL, reversal.getTransactionType());
        assertEquals(TransactionStatus.COMPLETED, reversal.getTransactionStatus());
        assertEquals("REVERSAL-77", reversal.getIdempotencyKey());
        assertEquals(77, reversal.getOriginalTransactionId());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Iterable<LedgerEntry>> ledgerCaptor =
                (ArgumentCaptor<Iterable<LedgerEntry>>) (ArgumentCaptor<?>)
                        ArgumentCaptor.forClass(Iterable.class);
        verify(ledgerEntryRepository).saveAll(ledgerCaptor.capture());
        List<LedgerEntry> entries = new java.util.ArrayList<>();
        ledgerCaptor.getValue().forEach(entries::add);
        assertEquals(2, entries.size());
        assertEquals(EntryType.DEBIT, entries.get(0).getEntryType());
        assertEquals(20, entries.get(0).getAccountId());
        assertEquals(EntryType.CREDIT, entries.get(1).getEntryType());
        assertEquals(10, entries.get(1).getAccountId());

        InOrder order = inOrder(accountRepository, transactionRepository);
        order.verify(accountRepository).lockWalletAccountsByIdsOrdered(anyList());
        order.verify(transactionRepository).existsByOriginalTransactionId(77);
    }

    @Test
    void reversal_rejectsAlreadyReversedTransactionAfterLockingAccounts() {
        Account sender = account(10, AccountType.BANK, "4000.00");
        Account receiver = account(20, AccountType.WALLET, "300.00");
        Transaction original = originalTransaction(
                77, 10, 20, "100.00", TransactionType.ADD_MONEY);

        when(accountRepository.lockWalletAccountsByIdsOrdered(List.of(10, 20)))
                .thenReturn(List.of(sender, receiver));
        when(transactionRepository.existsByOriginalTransactionId(77)).thenReturn(true);

        assertThrows(
                AlreadyReversedException.class,
                () -> ledgerPostingService.postReversal(original, 5)
        );

        verify(transactionRepository, never()).saveAndFlush(any(Transaction.class));
        verify(ledgerEntryRepository, never()).saveAll(any(Iterable.class));
    }

    @Test
    void reversal_rejectsWhenOriginalReceiverHasAlreadySpentFunds() {
        Account sender = account(10, AccountType.BANK, "4000.00");
        Account receiver = account(20, AccountType.WALLET, "50.00");
        Transaction original = originalTransaction(
                77, 10, 20, "100.00", TransactionType.ADD_MONEY);

        when(accountRepository.lockWalletAccountsByIdsOrdered(List.of(10, 20)))
                .thenReturn(List.of(sender, receiver));
        when(transactionRepository.existsByOriginalTransactionId(77)).thenReturn(false);
        when(transactionRepository.findByIdempotencyKey("REVERSAL-77"))
                .thenReturn(Optional.empty());

        assertThrows(
                InsufficientFundsException.class,
                () -> ledgerPostingService.postReversal(original, 5)
        );

        assertEquals(0, new BigDecimal("4000.00").compareTo(sender.getBalance()));
        assertEquals(0, new BigDecimal("50.00").compareTo(receiver.getBalance()));
        verify(transactionRepository, never()).saveAndFlush(any(Transaction.class));
        verify(ledgerEntryRepository, never()).saveAll(any(Iterable.class));
    }

    private Account account(Integer id, AccountType type, String balance) {
        Account account = new Account(1, type, new BigDecimal(balance));
        ReflectionTestUtils.setField(account, "accountId", id);
        return account;
    }

    private Transaction originalTransaction(
            Integer id,
            Integer sender,
            Integer receiver,
            String amount,
            TransactionType type) {
        Transaction transaction = new Transaction(
                sender,
                receiver,
                new BigDecimal(amount),
                type,
                TransactionStatus.COMPLETED,
                "ORIGINAL-" + id,
                null
        );
        ReflectionTestUtils.setField(transaction, "transactionId", id);
        return transaction;
    }
}