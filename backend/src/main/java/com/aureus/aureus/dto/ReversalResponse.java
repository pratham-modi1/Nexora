package com.aureus.aureus.dto;

import com.aureus.aureus.entity.TransactionStatus;

import java.math.BigDecimal;

public class ReversalResponse {

    private Integer reversalTransactionId;
    private Integer originalTransactionId;
    private BigDecimal amount;
    private TransactionStatus status;

    public ReversalResponse(
            Integer reversalTransactionId,
            Integer originalTransactionId,
            BigDecimal amount,
            TransactionStatus status) {
        this.reversalTransactionId = reversalTransactionId;
        this.originalTransactionId = originalTransactionId;
        this.amount = amount;
        this.status = status;
    }

    public Integer getReversalTransactionId() {
        return reversalTransactionId;
    }

    public Integer getOriginalTransactionId() {
        return originalTransactionId;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public TransactionStatus getStatus() {
        return status;
    }
}