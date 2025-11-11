/**
 * X402 Payment Middleware for Tyk Gateway
 *
 * This middleware implements the X402 payment protocol for protecting API resources
 * with blockchain-based micropayments. It handles both payment verification (pre-request)
 * and settlement (post-request) phases.
 *
 * Usage:
 *   - Add to "pre" middleware array for payment verification
 *   - Add to "post" middleware array for payment settlement
 *
 * @see https://github.com/emfidev/x402-tyk-middleware
 * @license MIT
 */

// ============================================================================
// Configuration Constants
// ============================================================================

var FACILITATOR_URL = "https://facilitator.emfi.dev";
var MIDDLEWARE_VERSION = "1.0.0";

// ============================================================================
// Middleware Instance
// ============================================================================

var x402_payment = new TykJS.TykMiddleware.NewMiddleware({});

// ============================================================================
// Main Request Handler
// ============================================================================

/**
 * Main middleware function that handles both pre and post phases.
 *
 * Pre-request phase (when in "pre" array):
 *   - Verifies X402 payment before allowing access to resource
 *   - Returns 402 if no payment or invalid payment
 *   - Adds payment metadata to headers if valid
 *
 * Post-request phase (when in "post" array):
 *   - Settles verified payments with facilitator
 *   - Only runs if payment was previously verified
 */
x402_payment.NewProcessRequest(function(request, session) {
    // Detect which phase we're in by checking if payment has been validated
    var paymentValid = request.Headers["X-Payment-Valid"];
    var isPostPhase = paymentValid && paymentValid[0] === "true";

    if (isPostPhase) {
        // POST-REQUEST PHASE: Settlement
        return handleSettlement(request);
    } else {
        // PRE-REQUEST PHASE: Verification
        return handleVerification(request, session);
    }
});

// ============================================================================
// PRE-REQUEST PHASE: Payment Verification
// ============================================================================

/**
 * Handles payment verification in pre-request phase
 */
function handleVerification(request, session) {
    var path = request.URL;
    var method = request.Method.toLowerCase();

    // Get route configuration from session metadata
    var config = session.config_data || {};
    var routeConfig = config.paths ? config.paths[path] : null;

    if (!routeConfig || !routeConfig[method]) {
        // No configuration for this route - allow through
        return x402_payment.ReturnData(request, {});
    }

    var methodConfig = routeConfig[method];

    // Check if route requires X402 payment
    if (!methodConfig.x402) {
        // No payment required - allow through
        return x402_payment.ReturnData(request, {});
    }

    // Verify X402 payment
    return verifyPayment(request, methodConfig.x402);
}

/**
 * Verifies X402 payment for a protected resource
 *
 * @param {object} request - Tyk request object
 * @param {object} x402Config - X402 payment configuration for this route
 * @returns {object} - Result for ReturnData
 */
function verifyPayment(request, x402Config) {
    try {
        // Step 1: Extract payment header
        var paymentHeader = request.Headers["X-Payment-x402"] || request.Headers["X-Payment-X402"];

        // Step 2: If no payment provided, return 402 with payment requirements
        if (!paymentHeader || paymentHeader.length === 0) {
            log("No payment header found for " + request.URL);
            return requestPayment(request, x402Config);
        }

        // Step 3: Parse payment proof
        var paymentProof;
        try {
            var rawPayment = Array.isArray(paymentHeader) ? paymentHeader[0] : paymentHeader;
            paymentProof = JSON.parse(rawPayment);
            log("Payment proof parsed successfully");
        } catch (e) {
            log("ERROR: Failed to parse payment header: " + e.toString());
            return rejectPayment(request, "Invalid JSON in X-Payment-x402 header");
        }

        // Step 4: Verify payment with facilitator
        log("Verifying payment with facilitator: " + FACILITATOR_URL);

        var verificationResult = callFacilitator("/v1/verify", {
            paymentPayload: {
                network: x402Config.network,
                transaction: paymentProof.transaction || paymentProof.payload || ""
            },
            paymentRequirements: {
                network: x402Config.network,
                kind: "spl-token",
                recipient: x402Config.payTo,
                feePayer: x402Config.feePayer,
                amount: parseInt(x402Config.maxAmountRequired),
                token: x402Config.asset
            }
        });

        if (!verificationResult.success) {
            log("Payment verification failed: " + verificationResult.error);
            return rejectPayment(request, verificationResult.error);
        }

        var verifyBody = verificationResult.data;

        // Step 5: Check if payment is valid
        if (!verifyBody.isValid) {
            var errorMsg = verifyBody.error || verifyBody.message || "Payment not valid";
            log("Payment validation failed: " + errorMsg);
            return rejectPayment(request, errorMsg);
        }

        // Step 6: Payment valid - add metadata headers for post-processing
        request.SetHeaders["X-Payment-Valid"] = "true";
        request.SetHeaders["X-Payment-Network"] = x402Config.network;
        request.SetHeaders["X-Payment-Tx"] = verifyBody.transaction || "unknown";
        request.SetHeaders["X-Payment-Payer"] = verifyBody.payer || "anonymous";
        request.SetHeaders["X-Payment-Amount"] = x402Config.maxAmountRequired;
        request.SetHeaders["X-Payment-Token"] = x402Config.asset;
        request.SetHeaders["X-Payment-Recipient"] = x402Config.payTo;

        log("Payment verified successfully for " + request.URL);

        return x402_payment.ReturnData(request, {});

    } catch (e) {
        log("CRITICAL ERROR: " + e.toString());
        request.ReturnOverrides.ResponseCode = 500;
        request.ReturnOverrides.ResponseError = JSON.stringify({
            error: "Internal Server Error",
            message: "Payment verification failed due to internal error"
        });
        request.ReturnOverrides.ResponseHeaders = { "Content-Type": "application/json" };
        return x402_payment.ReturnData(request, {});
    }
}

// ============================================================================
// POST-REQUEST PHASE: Payment Settlement
// ============================================================================

/**
 * Handles payment settlement in post-request phase
 *
 * This runs AFTER the upstream has responded and the client has received the data.
 * Only settles if payment was previously verified as valid.
 */
function handleSettlement(request) {
    // Extract payment metadata (set during verification phase)
    var transaction = getHeaderValue(request.Headers["X-Payment-Tx"]);
    var network = getHeaderValue(request.Headers["X-Payment-Network"]);
    var amount = getHeaderValue(request.Headers["X-Payment-Amount"]);
    var token = getHeaderValue(request.Headers["X-Payment-Token"]);
    var recipient = getHeaderValue(request.Headers["X-Payment-Recipient"]);

    if (!transaction || transaction === "unknown") {
        log("Cannot settle: missing transaction information");
        return x402_payment.ReturnData(request, {});
    }

    log("Settling payment for transaction: " + transaction);

    try {
        settlePayment(transaction, network, recipient, amount, token);
    } catch (e) {
        // Settlement failure should not block the response
        // The user already paid and received content
        log("ERROR: Settlement failed: " + e.toString());
    }

    return x402_payment.ReturnData(request, {});
}

/**
 * Settles a verified payment transaction with the facilitator
 *
 * @param {string} transaction - Transaction signature/hash
 * @param {string} network - Blockchain network (e.g., "solana-devnet")
 * @param {string} recipient - Payment recipient address
 * @param {string} amount - Payment amount
 * @param {string} token - Token/asset address
 */
function settlePayment(transaction, network, recipient, amount, token) {
    log("Calling facilitator to settle transaction");

    var settleResult = callFacilitator("/v1/settle", {
        network: network,
        transaction: transaction,
        recipient: recipient,
        amount: parseInt(amount),
        token: token
    });

    if (!settleResult.success) {
        log("Settlement failed: " + settleResult.error);
        return;
    }

    var settleBody = settleResult.data;
    log("Settlement successful: " + JSON.stringify(settleBody));

    if (settleBody.signature) {
        log("Settlement signature: " + settleBody.signature);
    }
}

// ============================================================================
// Helper Functions: Payment Responses
// ============================================================================

/**
 * Returns 402 Payment Required with payment requirements
 */
function requestPayment(request, x402Config) {
    var paymentInfo = {
        error: "Payment Required",
        message: "This resource requires a valid X402 payment",
        x402Version: 1,
        paymentRequirements: {
            scheme: x402Config.scheme || "exact",
            network: x402Config.network || "solana-devnet",
            description: x402Config.description || "Access to " + request.URL,
            payTo: x402Config.payTo,
            asset: x402Config.asset,
            maxAmountRequired: x402Config.maxAmountRequired || "1000000",
            maxTimeoutSeconds: 60
        },
        instructions: {
            step1: "Sign a transaction with your wallet",
            step2: "Include the signed payment object in the X-Payment-x402 header",
            headerExample: "X-Payment-x402: { x402PaymentObject }"
        }
    };

    request.ReturnOverrides.ResponseCode = 402;
    request.ReturnOverrides.ResponseError = JSON.stringify(paymentInfo);
    request.ReturnOverrides.ResponseHeaders = {
        "Content-Type": "application/json",
        "X-Payment-Required": "x402",
        "X-Payment-Status": "required",
        "X-Payment-Protocol-Version": MIDDLEWARE_VERSION
    };

    return x402_payment.ReturnData(request, {});
}

/**
 * Returns 402 Payment Required with rejection reason
 */
function rejectPayment(request, reason) {
    request.ReturnOverrides.ResponseCode = 402;
    request.ReturnOverrides.ResponseError = JSON.stringify({
        error: "Payment Invalid",
        message: reason
    });
    request.ReturnOverrides.ResponseHeaders = {
        "Content-Type": "application/json",
        "X-Payment-Status": "invalid"
    };
    return x402_payment.ReturnData(request, {});
}

// ============================================================================
// Helper Functions: Facilitator Communication
// ============================================================================

/**
 * Makes an HTTP request to the facilitator service
 *
 * @param {string} endpoint - API endpoint path (e.g., "/v1/verify")
 * @param {object} payload - Request payload
 * @returns {object} - {success: boolean, data?: object, error?: string}
 */
function callFacilitator(endpoint, payload) {
    var requestBody = JSON.stringify(payload);

    var httpRequest = {
        "Method": "POST",
        "Body": requestBody,
        "Headers": {
            "Content-Type": "application/json"
        },
        "Domain": FACILITATOR_URL,
        "Resource": endpoint
    };

    var httpRequestString = JSON.stringify(httpRequest);
    var responseString = TykMakeHttpRequest(httpRequestString);

    if (!responseString) {
        return {
            success: false,
            error: "Failed to communicate with facilitator (no response)"
        };
    }

    var response;
    try {
        response = JSON.parse(responseString);
    } catch (e) {
        return {
            success: false,
            error: "Invalid response from facilitator: " + e.toString()
        };
    }

    if (!response.Code) {
        return {
            success: false,
            error: "Invalid response format from facilitator"
        };
    }

    if (response.Code !== 200) {
        return {
            success: false,
            error: "Facilitator returned status " + response.Code + ": " + response.Body
        };
    }

    var responseBody;
    try {
        responseBody = JSON.parse(response.Body);
    } catch (e) {
        return {
            success: false,
            error: "Failed to parse facilitator response body: " + e.toString()
        };
    }

    return {
        success: true,
        data: responseBody
    };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extracts a single value from a header (which may be an array)
 */
function getHeaderValue(header) {
    if (!header) return null;
    return Array.isArray(header) ? header[0] : header;
}

/**
 * Logs a message with consistent prefix
 */
function log(msg) {
    rawlog("[x402] " + msg);
}
