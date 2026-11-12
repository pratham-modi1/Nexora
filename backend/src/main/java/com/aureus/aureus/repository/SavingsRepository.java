package com.aureus.aureus.repository;

import com.aureus.aureus.entity.Savings;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SavingsRepository extends JpaRepository<Savings, Integer> {

    List<Savings> findByUserIdOrderByDeadlineAsc(Integer userId);

    Optional<Savings> findByGoalIdAndUserId(Integer goalId, Integer userId);
}
