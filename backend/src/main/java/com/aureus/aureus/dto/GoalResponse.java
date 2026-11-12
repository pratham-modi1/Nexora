package com.aureus.aureus.dto;

import com.aureus.aureus.entity.GoalStatus;

import java.math.BigDecimal;
import java.time.LocalDate;

public class GoalResponse {

    private Integer goalId;
    private String goalName;
    private BigDecimal targetAmount;
    private LocalDate deadline;
    private GoalStatus status;
    private BigDecimal walletBalance;
    private BigDecimal remainingAmount;
    private int monthsRemaining;
    private BigDecimal suggestedMonthly;
    private BigDecimal progressPercent;
    private boolean achieved;

    public GoalResponse(
            Integer goalId,
            String goalName,
            BigDecimal targetAmount,
            LocalDate deadline,
            GoalStatus status,
            BigDecimal walletBalance,
            BigDecimal remainingAmount,
            int monthsRemaining,
            BigDecimal suggestedMonthly,
            BigDecimal progressPercent,
            boolean achieved) {

        this.goalId = goalId;
        this.goalName = goalName;
        this.targetAmount = targetAmount;
        this.deadline = deadline;
        this.status = status;
        this.walletBalance = walletBalance;
        this.remainingAmount = remainingAmount;
        this.monthsRemaining = monthsRemaining;
        this.suggestedMonthly = suggestedMonthly;
        this.progressPercent = progressPercent;
        this.achieved = achieved;
    }

    public Integer getGoalId() {
        return goalId;
    }

    public String getGoalName() {
        return goalName;
    }

    public BigDecimal getTargetAmount() {
        return targetAmount;
    }

    public LocalDate getDeadline() {
        return deadline;
    }

    public GoalStatus getStatus() {
        return status;
    }

    public BigDecimal getWalletBalance() {
        return walletBalance;
    }

    public BigDecimal getRemainingAmount() {
        return remainingAmount;
    }

    public int getMonthsRemaining() {
        return monthsRemaining;
    }

    public BigDecimal getSuggestedMonthly() {
        return suggestedMonthly;
    }

    public BigDecimal getProgressPercent() {
        return progressPercent;
    }

    public boolean isAchieved() {
        return achieved;
    }
}
