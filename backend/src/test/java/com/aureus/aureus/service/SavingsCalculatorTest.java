package com.aureus.aureus.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SavingsCalculatorTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 9);

    @Test
    void calculatesNormalGoalProgress() {
        SavingsCalculator.Result result = SavingsCalculator.calculate(
                new BigDecimal("10000.00"),
                new BigDecimal("2000.00"),
                LocalDate.of(2027, 3, 9),
                TODAY
        );

        assertEquals(new BigDecimal("8000.00"), result.remainingAmount());
        assertEquals(4, result.monthsRemaining());
        assertEquals(new BigDecimal("2000.00"), result.suggestedMonthly());
        assertEquals(new BigDecimal("20.00"), result.progressPercent());
        assertEquals(new BigDecimal("2000.00"), result.walletBalance());
        assertFalse(result.achieved());
    }

    @Test
    void achievedGoalHasNoRemainingOrSuggestedAmount() {
        SavingsCalculator.Result result = SavingsCalculator.calculate(
                new BigDecimal("10000.00"),
                new BigDecimal("12000.00"),
                LocalDate.of(2027, 3, 9),
                TODAY
        );

        assertEquals(new BigDecimal("0.00"), result.remainingAmount());
        assertEquals(new BigDecimal("0.00"), result.suggestedMonthly());
        assertEquals(new BigDecimal("100.00"), result.progressPercent());
        assertTrue(result.achieved());
    }

    @Test
    void passedDeadlineHasZeroMonthsAndFullRemainderSuggested() {
        SavingsCalculator.Result result = SavingsCalculator.calculate(
                new BigDecimal("10000.00"),
                new BigDecimal("2000.00"),
                LocalDate.of(2026, 11, 8),
                TODAY
        );

        assertEquals(0, result.monthsRemaining());
        assertEquals(new BigDecimal("8000.00"), result.suggestedMonthly());
    }

    @Test
    void deadlineTodayHasZeroMonthsRemaining() {
        SavingsCalculator.Result result = SavingsCalculator.calculate(
                new BigDecimal("10000.00"),
                new BigDecimal("2000.00"),
                TODAY,
                TODAY
        );

        assertEquals(0, result.monthsRemaining());
        assertEquals(new BigDecimal("8000.00"), result.suggestedMonthly());
    }

    @Test
    void zeroRemainingAmountIsNeverNegative() {
        SavingsCalculator.Result result = SavingsCalculator.calculate(
                new BigDecimal("10000.00"),
                new BigDecimal("15000.00"),
                LocalDate.of(2027, 3, 9),
                TODAY
        );

        assertEquals(new BigDecimal("0.00"), result.remainingAmount());
        assertTrue(result.remainingAmount().compareTo(BigDecimal.ZERO) >= 0);
    }

    @Test
    void roundsSuggestedMonthlyAmountUpToTwoDecimalPlaces() {
        SavingsCalculator.Result result = SavingsCalculator.calculate(
                new BigDecimal("10000.00"),
                new BigDecimal("0.00"),
                LocalDate.of(2027, 2, 9),
                TODAY
        );

        assertEquals(3, result.monthsRemaining());
        assertEquals(new BigDecimal("3333.34"), result.suggestedMonthly());
    }

    @Test
    void roundsPartialRemainingMonthUpToNextWholeMonth() {
        SavingsCalculator.Result result = SavingsCalculator.calculate(
                new BigDecimal("10000.00"),
                new BigDecimal("0.00"),
                LocalDate.of(2027, 3, 10),
                TODAY
        );

        // Four calendar months plus one day are rounded up to five.
        assertEquals(5, result.monthsRemaining());
    }

    @Test
    void progressPercentageNeverExceedsOneHundred() {
        SavingsCalculator.Result result = SavingsCalculator.calculate(
                new BigDecimal("10000.00"),
                new BigDecimal("25000.00"),
                LocalDate.of(2027, 3, 9),
                TODAY
        );

        assertEquals(new BigDecimal("100.00"), result.progressPercent());
        assertTrue(result.progressPercent().compareTo(new BigDecimal("100.00")) <= 0);
    }

    @Test
    void monetaryResultsAlwaysHaveScaleTwo() {
        SavingsCalculator.Result result = SavingsCalculator.calculate(
                new BigDecimal("10000"),
                new BigDecimal("2000"),
                LocalDate.of(2027, 3, 9),
                TODAY
        );

        assertEquals(2, result.walletBalance().scale());
        assertEquals(2, result.remainingAmount().scale());
        assertEquals(2, result.suggestedMonthly().scale());
        assertEquals(2, result.progressPercent().scale());
    }
}
