package com.aureus.aureus.service;

import com.aureus.aureus.dto.ReconciliationResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReconciliationServiceTest {

    @Mock private JdbcTemplate jdbcTemplate;

    @Test
    void reconciliationReturnsOkWhenAllFiveChecksPass() {
        when(jdbcTemplate.queryForList(anyString(), eq(String.class)))
                .thenReturn(List.of());
        when(jdbcTemplate.queryForMap(anyString())).thenReturn(Map.of(
                "total_debits", new BigDecimal("1000.00"),
                "total_credits", new BigDecimal("1000.00")
        ));
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class)))
                .thenReturn(1);
        when(jdbcTemplate.queryForObject(anyString(), eq(BigDecimal.class)))
                .thenReturn(new BigDecimal("99999999.99"));

        ReconciliationService service = new ReconciliationService(
                jdbcTemplate,
                new BigDecimal("99999999.99")
        );

        ReconciliationResponse response = service.runReconciliation(1);

        assertEquals("OK", response.getStatus());
        assertEquals(5, response.getChecks().size());
        assertTrue(response.getChecks().stream().allMatch(c -> c.isPassed()));
    }

    @Test
    void reconciliationReturnsMismatchWhenAnyCheckFindsAnOffender() {
        when(jdbcTemplate.queryForList(anyString(), eq(String.class)))
                .thenReturn(List.of("transaction_id=99"), List.of(), List.of());
        when(jdbcTemplate.queryForMap(anyString())).thenReturn(Map.of(
                "total_debits", new BigDecimal("1000.00"),
                "total_credits", new BigDecimal("1000.00")
        ));
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class)))
                .thenReturn(1);
        when(jdbcTemplate.queryForObject(anyString(), eq(BigDecimal.class)))
                .thenReturn(new BigDecimal("99999999.99"));

        ReconciliationService service = new ReconciliationService(
                jdbcTemplate,
                new BigDecimal("99999999.99")
        );

        ReconciliationResponse response = service.runReconciliation(1);

        assertEquals("MISMATCH", response.getStatus());
        assertTrue(response.getChecks().stream().anyMatch(c -> !c.isPassed()));
    }
}