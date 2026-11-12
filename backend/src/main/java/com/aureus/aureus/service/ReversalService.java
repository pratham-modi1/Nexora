package com.aureus.aureus.service;

import com.aureus.aureus.dto.ReversalResponse;
import com.aureus.aureus.entity.Transaction;
import com.aureus.aureus.entity.TransactionStatus;
import com.aureus.aureus.entity.TransactionType;
import com.aureus.aureus.exception.ReversalNotAllowedException;
import com.aureus.aureus.exception.TransactionNotFoundException;
import com.aureus.aureus.repository.TransactionRepository;

import org.springframework.stereotype.Service;

@Service
public class ReversalService {

    private final TransactionRepository transactionRepository;
    private final LedgerPostingService ledgerPostingService;

    public ReversalService(
            TransactionRepository transactionRepository,
            LedgerPostingService ledgerPostingService) {
        this.transactionRepository = transactionRepository;
        this.ledgerPostingService = ledgerPostingService;
    }

    /*
     * Deliberately not @Transactional. The original transaction is read
     * before entering the new posting transaction. Its transaction fields
     * are immutable after completion; account rows are locked inside
     * LedgerPostingService before any balance-dependent decision is made.
     */
    public ReversalResponse reverseTransaction(
            Integer originalTransactionId,
            Integer adminUserId) {

        if (originalTransactionId == null || originalTransactionId <= 0) {
            throw new TransactionNotFoundException("Transaction not found");
        }

        Transaction original = transactionRepository.findById(originalTransactionId)
                .orElseThrow(() ->
                        new TransactionNotFoundException("Transaction not found")
                );

        boolean reversibleType =
                original.getTransactionType() == TransactionType.ADD_MONEY
                || original.getTransactionType() == TransactionType.WITHDRAWAL
                || original.getTransactionType() == TransactionType.TRANSFER;

        if (!reversibleType
                || original.getTransactionStatus() != TransactionStatus.COMPLETED) {
            throw new ReversalNotAllowedException(
                    "Only completed ADD_MONEY, WITHDRAWAL and TRANSFER transactions can be reversed"
            );
        }

        return ledgerPostingService.postReversal(original, adminUserId);
    }
}