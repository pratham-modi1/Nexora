package com.aureus.aureus.controller;

import com.aureus.aureus.dto.ReconciliationResponse;
import com.aureus.aureus.dto.ReversalResponse;
import com.aureus.aureus.security.AuthenticatedUser;
import com.aureus.aureus.service.ReconciliationService;
import com.aureus.aureus.service.ReversalService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final ReversalService reversalService;
    private final ReconciliationService reconciliationService;

    public AdminController(
            ReversalService reversalService,
            ReconciliationService reconciliationService) {
        this.reversalService = reversalService;
        this.reconciliationService = reconciliationService;
    }

    @PostMapping("/transactions/{id}/reverse")
    public ResponseEntity<ReversalResponse> reverseTransaction(
            @AuthenticationPrincipal AuthenticatedUser admin,
            @PathVariable("id") Integer transactionId) {

        ReversalResponse response = reversalService.reverseTransaction(
                transactionId,
                admin.userId()
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/reconciliation")
    public ResponseEntity<ReconciliationResponse> reconcile(
            @AuthenticationPrincipal AuthenticatedUser admin) {

        ReconciliationResponse response =
                reconciliationService.runReconciliation(admin.userId());

        return ResponseEntity.ok(response);
    }
}