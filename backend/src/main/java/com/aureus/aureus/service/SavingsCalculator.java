package com.aureus.aureus.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.Period;
import java.util.Objects;

/**
 * Pure calculation utility for tracking-only savings goals.
 * It does not read from or write to the database.
 */
public final class SavingsCalculator {

    private static final BigDecimal ZERO = new BigDecimal("0.00");
    private static final BigDecimal HUNDRED = new BigDecimal("100.00");

    private SavingsCalculator() {
    }

    /** Uses the current date. */
    public static Result calculate(
            BigDecimal targetAmount,
            BigDecimal walletBalance,
            LocalDate deadline) {

        return calculate(targetAmount, walletBalance, deadline, LocalDate.now());
    }

    /**
     * Date-injectable overload makes the calculation deterministic in tests.
     */
    public static Result calculate(
            BigDecimal targetAmount,
            BigDecimal walletBalance,
            LocalDate deadline,
            LocalDate today) {

        Objects.requireNonNull(targetAmount, "targetAmount cannot be null");
        Objects.requireNonNull(walletBalance, "walletBalance cannot be null");
        Objects.requireNonNull(deadline, "deadline cannot be null");
        Objects.requireNonNull(today, "today cannot be null");

        BigDecimal target = targetAmount.setScale(2, RoundingMode.HALF_UP);
        if (target.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("targetAmount must be greater than zero");
        }

        // A database balance should never be negative; clamp defensively.
        BigDecimal balance = walletBalance
                .max(BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);

        boolean achieved = balance.compareTo(target) >= 0;

        BigDecimal remaining = target.subtract(balance)
                .max(BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);

        int monthsRemaining = calculateMonthsRemaining(today, deadline);

        BigDecimal suggestedMonthly;
        if (achieved) {
            suggestedMonthly = ZERO;
        } else if (monthsRemaining == 0) {
            // Deadline is today or has passed: the full remainder is due.
            suggestedMonthly = remaining;
        } else {
            suggestedMonthly = remaining.divide(
                    BigDecimal.valueOf(monthsRemaining),
                    2,
                    RoundingMode.CEILING
            ).setScale(2, RoundingMode.HALF_UP);
        }

        BigDecimal progressPercent = balance
                .multiply(HUNDRED)
                .divide(target, 2, RoundingMode.HALF_UP)
                .max(ZERO)
                .min(HUNDRED)
                .setScale(2, RoundingMode.HALF_UP);

        return new Result(
                balance,
                remaining,
                monthsRemaining,
                suggestedMonthly,
                progressPercent,
                achieved
        );
    }

    /**
     * Counts a partial month as one whole remaining month.
     * Returns zero when the deadline is today or has passed.
     */
    private static int calculateMonthsRemaining(
            LocalDate today,
            LocalDate deadline) {

        if (!deadline.isAfter(today)) {
            return 0;
        }

        Period period = Period.between(today, deadline);
        int wholeMonths = period.getYears() * 12 + period.getMonths();

        if (period.getDays() > 0) {
            wholeMonths++;
        }

        return Math.max(wholeMonths, 1);
    }

    public record Result(
            BigDecimal walletBalance,
            BigDecimal remainingAmount,
            int monthsRemaining,
            BigDecimal suggestedMonthly,
            BigDecimal progressPercent,
            boolean achieved) {
    }
}
