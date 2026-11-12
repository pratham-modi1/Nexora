package com.aureus.aureus.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "Savings")
public class Savings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "goal_id")
    private Integer goalId;

    @Column(name = "user_id", nullable = false)
    private Integer userId;

    @Column(name = "goal_name", nullable = false, length = 100)
    private String goalName;

    @Column(name = "target_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal targetAmount;

    @Column(name = "deadline", nullable = false)
    private LocalDate deadline;

    @Enumerated(EnumType.STRING)
    @Column(name = "goal_status", nullable = false, length = 10)
    private GoalStatus goalStatus;

    protected Savings() {
    }

    public Savings(
            Integer userId,
            String goalName,
            BigDecimal targetAmount,
            LocalDate deadline,
            GoalStatus goalStatus) {
        this.userId = userId;
        this.goalName = goalName;
        this.targetAmount = targetAmount;
        this.deadline = deadline;
        this.goalStatus = goalStatus;
    }

    public Integer getGoalId() {
        return goalId;
    }

    public Integer getUserId() {
        return userId;
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

    public GoalStatus getGoalStatus() {
        return goalStatus;
    }

    public void setGoalStatus(GoalStatus goalStatus) {
        this.goalStatus = goalStatus;
    }
}
