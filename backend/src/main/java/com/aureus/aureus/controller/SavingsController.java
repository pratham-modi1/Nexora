package com.aureus.aureus.controller;

import com.aureus.aureus.dto.CreateGoalRequest;
import com.aureus.aureus.dto.GoalResponse;
import com.aureus.aureus.dto.GoalStatusRequest;

import com.aureus.aureus.security.AuthenticatedUser;
import com.aureus.aureus.service.SavingsService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/savings")
public class SavingsController {

    private final SavingsService savingsService;

    public SavingsController(SavingsService savingsService) {
        this.savingsService = savingsService;
    }

    @PostMapping
    public ResponseEntity<GoalResponse> createGoal(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @Valid @RequestBody CreateGoalRequest request) {

        GoalResponse response = savingsService.createGoal(
                principal.userId(),
                request
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<GoalResponse>> getAllGoals(
            @AuthenticationPrincipal AuthenticatedUser principal) {

        List<GoalResponse> response =
                savingsService.getAllGoals(principal.userId());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<GoalResponse> getGoalById(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable("id") Integer goalId) {

        GoalResponse response = savingsService.getGoalById(
                principal.userId(),
                goalId
        );

        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<GoalResponse> changeGoalStatus(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable("id") Integer goalId,
            @Valid @RequestBody GoalStatusRequest request) {

        GoalResponse response = savingsService.changeGoalStatus(
                principal.userId(),
                goalId,
                request.getStatus()
        );

        return ResponseEntity.ok(response);
    }
}
