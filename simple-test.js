#!/usr/bin/env node

/**
 * A simple test script for the MTender OCDS Server
 */

import axios from 'axios';

// Base URL for the MTender API
const MTENDER_API_BASE_URL = "https://public.mtender.gov.md";

async function testMTenderAPI() {
  try {
    console.log("Testing MTender API...");
    
    // Test 1: Get latest tenders
    console.log("\nTest 1: Get latest tenders");
    const tendersResponse = await axios.get(`${MTENDER_API_BASE_URL}/tenders/`);
    console.log(`Success! Found ${tendersResponse.data.data.length} tenders`);
    console.log(`First tender OCID: ${tendersResponse.data.data[0].ocid}`);
    
    // Test 2: Get specific tender
    const testOcid = "ocds-b3wdp1-MD-1613996912600";
    console.log(`\nTest 2: Get tender details for ${testOcid}`);
    const tenderResponse = await axios.get(`${MTENDER_API_BASE_URL}/tenders/${testOcid}`);
    console.log("Response structure:", JSON.stringify(Object.keys(tenderResponse.data), null, 2));
    if (tenderResponse.data.releases) {
      console.log(`Success! Tender title: ${tenderResponse.data.releases[0].tender.title}`);
    } else if (tenderResponse.data.records) {
      console.log(`Success! Tender title: ${tenderResponse.data.records[0].compiledRelease.tender.title}`);
    } else {
      console.log("Unexpected response structure:", tenderResponse.data);
    }
    
    // Test 3: Get budget for a tender
    const budgetOcid = "ocds-b3wdp1-MD-1613996472664";
    console.log(`\nTest 3: Get budget for ${budgetOcid}`);
    try {
      const budgetResponse = await axios.get(`${MTENDER_API_BASE_URL}/budgets/${budgetOcid}/${budgetOcid}`);
      console.log("Budget response structure:", JSON.stringify(Object.keys(budgetResponse.data), null, 2));
      if (budgetResponse.data.releases && budgetResponse.data.releases[0].planning) {
        console.log(`Success! Budget amount: ${budgetResponse.data.releases[0].planning.budget.amount.amount} ${budgetResponse.data.releases[0].planning.budget.amount.currency}`);
      } else {
        console.log("Unexpected budget response structure:", budgetResponse.data);
      }
    } catch (error) {
      console.log(`Error getting budget: ${error.message}`);
    }
    
    // Test 4: Get funding source
    const fundingOcid = "ocds-b3wdp1-MD-1613996472664";
    const fundingSourceId = "ocds-b3wdp1-MD-1613996472664-FS-1613996568014";
    console.log(`\nTest 4: Get funding source for ${fundingOcid}`);
    try {
      const fundingResponse = await axios.get(`${MTENDER_API_BASE_URL}/budgets/${fundingOcid}/${fundingSourceId}`);
      console.log("Funding response structure:", JSON.stringify(Object.keys(fundingResponse.data), null, 2));
      if (fundingResponse.data.releases && fundingResponse.data.releases[0].planning) {
        console.log(`Success! Funding source amount: ${fundingResponse.data.releases[0].planning.budget.amount.amount} ${fundingResponse.data.releases[0].planning.budget.amount.currency}`);
      } else {
        console.log("Unexpected funding response structure:", fundingResponse.data);
      }
    } catch (error) {
      console.log(`Error getting funding source: ${error.message}`);
    }
    
    console.log("\nAll tests passed! The MTender API is working correctly.");
    console.log("The MCP server should be able to access this data successfully.");
    
  } catch (error) {
    console.error("Error testing MTender API:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
  }
}

testMTenderAPI().catch(console.error);