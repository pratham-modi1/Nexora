package com.aureus.aureus.service;

import com.aureus.aureus.dto.CreateGoalRequest;
import com.aureus.aureus.dto.GoalResponse;

import com.aureus.aureus.entity.Account;
import com.aureus.aureus.entity.AccountType;
import com.aureus.aureus.entity.GoalStatus;
import com.aureus.aureus.entity.Savings;

import com.aureus.aureus.exception.AccountNotFoundException;
import com.aureus.aureus.exception.InvalidRequestException;

import com.aureus.aureus.repository.AccountRepository;
import com.aureus.aureus.repository.SavingsRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
public class SavingsServiceImpl implements SavingsService {

    private final SavingsRepository savingsRepository;
    private final AccountRepository accountRepository;

    public SavingsServiceImpl(
            SavingsRepository savingsRepository,
            AccountRepository accountRepository) {
        this.savingsRepository = savingsRepository;
        this.accountRepository = accountRepository;
    }

    @Override
    @Transactional
    public GoalResponse createGoal(
            Integer userId,
            CreateGoalRequest request) {

        if (request == null) {
            throw new InvalidRequestException("Goal details are required");
        }

        if (request.getGoalName() == null
                || request.getGoalName().isBlank()) {
            throw new InvalidRequestException("Goal name is required");
        }

        String normalizedGoalName = request.getGoalName().trim();
        if (normalizedGoalName.length() > 100) {
            throw new InvalidRequestException(
                    "Goal name cannot exceed 100 characters"
            );
        }

        if (request.getDeadline() == null
                || !request.getDeadline().isAfter(LocalDate.now())) {
            throw new InvalidRequestException("Deadline must be a future date");
        }

        if (request.getTargetAmount() == null
                || request.getTargetAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new InvalidRequestException("Target amount must be greater than zero");
        }

        if (request.getTargetAmount().scale() > 2
                || request.getTargetAmount().precision()
                    - request.getTargetAmount().scale() > 8) {
            throw new InvalidRequestException(
                    "Target amount supports at most 8 integer digits and 2 decimal places"
            );
        }

        Savings goal = new Savings(
                userId,
                normalizedGoalName,
                request.getTargetAmount().setScale(2),
                request.getDeadline(),
                GoalStatus.ACTIVE
        );

        Savings savedGoal = savingsRepository.save(goal);

        BigDecimal walletBalance = getWalletBalance(userId);

        return toGoalResponse(savedGoal, walletBalance);
    }

    @Override
    @Transactional(readOnly = true)
    public List<GoalResponse> getAllGoals(Integer userId) {

        List<Savings> goals =
                savingsRepository.findByUserIdOrderByDeadlineAsc(userId);

        // Read the wallet once, not once per goal.
        BigDecimal walletBalance = getWalletBalance(userId);

        return goals.stream()
                .map(goal -> toGoalResponse(goal, walletBalance))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public GoalResponse getGoalById(Integer userId, Integer goalId) {

        Savings goal = findOwnedGoal(userId, goalId);
        BigDecimal walletBalance = getWalletBalance(userId);

        return toGoalResponse(goal, walletBalance);
    }

    @Override
    @Transactional
    public GoalResponse changeGoalStatus(
            Integer userId,
            Integer goalId,
            GoalStatus requestedStatus) {

        if (requestedStatus == null) {
            throw new InvalidRequestException("Goal status is required");
        }

        Savings goal = findOwnedGoal(userId, goalId);
        GoalStatus currentStatus = goal.getGoalStatus();

        if (!isAllowedTransition(currentStatus, requestedStatus)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Cannot change goal status from "
                            + currentStatus + " to " + requestedStatus
            );
        }

        // Status changes only after an explicit request.
        // Reaching the target balance never changes status automatically.
        goal.setGoalStatus(requestedStatus);
        Savings updatedGoal = savingsRepository.save(goal);

        BigDecimal walletBalance = getWalletBalance(userId);

        return toGoalResponse(updatedGoal, walletBalance);
    }

    private Savings findOwnedGoal(Integer userId, Integer goalId) {
        return savingsRepository.findByGoalIdAndUserId(goalId, userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Savings goal not found"
                ));
    }

    private BigDecimal getWalletBalance(Integer userId) {
        Account wallet = accountRepository
                .findByUserIdAndAccountType(userId, AccountType.WALLET)
                .orElseThrow(() -> new AccountNotFoundException(
                        "WALLET account not found"
                ));

        return wallet.getBalance();
    }

    private GoalResponse toGoalResponse(
            Savings goal,
            BigDecimal walletBalance) {

        SavingsCalculator.Result calculation = SavingsCalculator.calculate(
                goal.getTargetAmount(),
                walletBalance,
                goal.getDeadline()
        );

        return new GoalResponse(
                goal.getGoalId(),
                goal.getGoalName(),
                goal.getTargetAmount(),
                goal.getDeadline(),
                goal.getGoalStatus(),
                calculation.walletBalance(),
                calculation.remainingAmount(),
                calculation.monthsRemaining(),
                calculation.suggestedMonthly(),
                calculation.progressPercent(),
                calculation.achieved()
        );
    }

    private boolean isAllowedTransition(
            GoalStatus current,
            GoalStatus requested) {

        return switch (current) {
            case ACTIVE -> requested == GoalStatus.PAUSED
                    || requested == GoalStatus.COMPLETED
                    || requested == GoalStatus.CANCELLED;

            case PAUSED -> requested == GoalStatus.ACTIVE
                    || requested == GoalStatus.COMPLETED
                    || requested == GoalStatus.CANCELLED;

            case COMPLETED, CANCELLED -> false;
        };
    }
}
