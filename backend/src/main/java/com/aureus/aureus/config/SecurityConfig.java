package com.aureus.aureus.config;

import com.aureus.aureus.repository.UserRepository;
import com.aureus.aureus.security.JwtAuthFilter;
import com.aureus.aureus.security.JsonAuthenticationEntryPoint;
import com.aureus.aureus.security.JsonAccessDeniedHandler;
import com.aureus.aureus.service.JwtService;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import org.springframework.security.config.Customizer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
public class SecurityConfig {

    // Existing BCrypt bean: keep this.
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // CORS: lets the Nexora frontend (Vite dev server) call this API from the browser.
    // Override with: aureus.cors.allowed-origins=https://your-site.com,http://localhost:5173
    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${aureus.cors.allowed-origins:http://localhost:5173,http://localhost:4173}")
            List<String> allowedOrigins) {

        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Idempotency-Key", "Accept"));
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            JwtService jwtService,
            UserRepository userRepository,
            JsonAuthenticationEntryPoint authenticationEntryPoint,
            JsonAccessDeniedHandler accessDeniedHandler)
            throws Exception {

        // Create JWT filter with its required dependencies.
        JwtAuthFilter jwtAuthFilter = new JwtAuthFilter(
                jwtService,
                userRepository,
                authenticationEntryPoint
        );

        http

            // 0. Enable CORS (uses the corsConfigurationSource bean above).
            .cors(Customizer.withDefaults())

            // 1. Disable CSRF for stateless Bearer-token API.
            .csrf(csrf -> csrf.disable())

            // 2. Disable browser-based authentication mechanisms.
            .formLogin(form -> form.disable())
            .httpBasic(basic -> basic.disable())

            // 3. No HTTP sessions.
            .sessionManagement(session ->
                    session.sessionCreationPolicy(
                            SessionCreationPolicy.STATELESS
                    )
            )

            // 4. Custom JSON 401 handler.
            .exceptionHandling(exception -> exception
                    .authenticationEntryPoint(authenticationEntryPoint)
                    .accessDeniedHandler(accessDeniedHandler)
            )

            // 5. Endpoint authorization rules.
            .authorizeHttpRequests(auth -> auth

                    // Registration and login are public.
                    .requestMatchers("/api/auth/**").permitAll()

                    // Admin routes require an authenticated ADMIN role.
                    .requestMatchers("/api/admin/**").hasRole("ADMIN")

                    // Everything else requires authentication.
                    .anyRequest().authenticated()
            )

            // 6. Insert JWT filter into the security chain.
            .addFilterBefore(
                    jwtAuthFilter,
                    UsernamePasswordAuthenticationFilter.class
            );

        return http.build();
    }
}