package com.aureus.aureus.dto;

import com.aureus.aureus.entity.GoalStatus;

import jakarta.validation.constraints.NotNull;

public class GoalStatusRequest {

    @NotNull(message = "Goal status is required")
    private GoalStatus status;

    public GoalStatusRequest() {
    }

    public GoalStatus getStatus() {
        return status;
    }

    public void setStatus(GoalStatus status) {
        this.status = status;
    }
}
