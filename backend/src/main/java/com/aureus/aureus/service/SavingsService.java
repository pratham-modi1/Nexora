package com.aureus.aureus.service;

import com.aureus.aureus.dto.CreateGoalRequest;
import com.aureus.aureus.dto.GoalResponse;
import com.aureus.aureus.entity.GoalStatus;

import java.util.List;

public interface SavingsService {

    GoalResponse createGoal(Integer userId, CreateGoalRequest request);

    List<GoalResponse> getAllGoals(Integer userId);

    GoalResponse getGoalById(Integer userId, Integer goalId);

    GoalResponse changeGoalStatus(
            Integer userId,
            Integer goalId,
            GoalStatus requestedStatus
    );
}
