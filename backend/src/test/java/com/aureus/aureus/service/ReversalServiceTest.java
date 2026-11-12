package com.aureus.aureus.service;

import com.aureus.aureus.entity.Transaction;
import com.aureus.aureus.entity.TransactionStatus;
import com.aureus.aureus.entity.TransactionType;
import com.aureus.aureus.exception.ReversalNotAllowedException;
import com.aureus.aureus.exception.TransactionNotFoundException;
import com.aureus.aureus.repository.TransactionRepository;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReversalServiceTest {

    @Mock private TransactionRepository transactionRepository;
    @Mock private LedgerPostingService ledgerPostingService;

    @InjectMocks private ReversalService reversalService;

    @Test
    void reverseTransaction_returnsNotFoundWhenOriginalDoesNotExist() {
        when(transactionRepository.findById(404)).thenReturn(Optional.empty());
        assertThrows(
                TransactionNotFoundException.class,
                () -> reversalService.reverseTransaction(404, 1)
        );
    }

    @Test
    void reversalDoesNotAllowOpeningBalance() {
        Transaction opening = transaction(TransactionType.OPENING_BALANCE,
                TransactionStatus.COMPLETED);
        when(transactionRepository.findById(10)).thenReturn(Optional.of(opening));

        assertThrows(
                ReversalNotAllowedException.class,
                () -> reversalService.reverseTransaction(10, 1)
        );
    }

    @Test
    void reversalDoesNotAllowFailedTransaction() {
        Transaction failed = transaction(TransactionType.ADD_MONEY,
                TransactionStatus.FAILED);
        when(transactionRepository.findById(10)).thenReturn(Optional.of(failed));

        assertThrows(
                ReversalNotAllowedException.class,
                () -> reversalService.reverseTransaction(10, 1)
        );
    }

    private Transaction transaction(TransactionType type, TransactionStatus status) {
        Transaction transaction = new Transaction(
                11, 12, new BigDecimal("25.00"), type, status, "ORIGINAL", null);
        ReflectionTestUtils.setField(transaction, "transactionId", 10);
        return transaction;
    }
}