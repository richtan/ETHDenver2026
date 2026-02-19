// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/JobMarketplace.sol";

contract JobMarketplaceTest is Test {
    JobMarketplace public marketplace;

    address deployer = address(1);
    address agentWallet = address(2);
    address client = address(3);
    address worker1 = address(4);
    address worker2 = address(5);

    function setUp() public {
        vm.prank(deployer);
        marketplace = new JobMarketplace(agentWallet);

        vm.deal(client, 10 ether);
        vm.deal(agentWallet, 1 ether);
        vm.deal(worker1, 1 ether);
        vm.deal(worker2, 1 ether);
    }

    // ─── Constructor & Admin ──────────────────────────────────────────

    function test_constructor() public view {
        assertEq(marketplace.agent(), agentWallet);
        assertEq(marketplace.owner(), deployer);
    }

    function test_setAgent() public {
        vm.prank(deployer);
        marketplace.setAgent(address(99));
        assertEq(marketplace.agent(), address(99));
    }

    function test_setAgent_revertNotOwner() public {
        vm.prank(client);
        vm.expectRevert();
        marketplace.setAgent(address(99));
    }

    function test_setAgent_revertZeroAddress() public {
        vm.prank(deployer);
        vm.expectRevert("Zero address");
        marketplace.setAgent(address(0));
    }

    function test_pauseUnpause() public {
        vm.startPrank(deployer);
        marketplace.pause();

        vm.stopPrank();
        vm.prank(client);
        vm.expectRevert();
        marketplace.createJob{value: 0.01 ether}("test");

        vm.prank(deployer);
        marketplace.unpause();

        vm.prank(client);
        marketplace.createJob{value: 0.01 ether}("test");
    }

    // ─── createJob ────────────────────────────────────────────────────

    function test_createJob() public {
        vm.prank(client);
        uint256 jobId = marketplace.createJob{value: 0.01 ether}("Design and post flyers");

        assertTrue(jobId != 0, "Job ID should be non-zero random");
        JobMarketplace.Job memory job = marketplace.getJob(jobId);
        assertEq(job.client, client);
        assertEq(job.totalBudget, 0.01 ether);
        assertEq(uint256(job.status), uint256(JobMarketplace.JobStatus.Created));
        assertEq(job.description, "Design and post flyers");
    }

    function test_createJob_emitsEvent() public {
        vm.prank(client);
        vm.expectEmit(false, true, false, true);
        emit JobMarketplace.JobCreated(0, client, 0.01 ether, "test job");
        marketplace.createJob{value: 0.01 ether}("test job");
    }

    function test_createJob_revertMinBudget() public {
        vm.prank(client);
        vm.expectRevert("Minimum budget 0.0001 ETH");
        marketplace.createJob{value: 0.00009 ether}("test");
    }

    function test_createJob_revertEmptyDescription() public {
        vm.prank(client);
        vm.expectRevert("Empty description");
        marketplace.createJob{value: 0.01 ether}("");
    }

    function test_clientJobs() public {
        vm.startPrank(client);
        uint256 id1 = marketplace.createJob{value: 0.01 ether}("Job 1");
        uint256 id2 = marketplace.createJob{value: 0.02 ether}("Job 2");
        vm.stopPrank();

        uint256[] memory ids = marketplace.getClientJobs(client);
        assertEq(ids.length, 2);
        assertEq(ids[0], id1);
        assertEq(ids[1], id2);
        assertTrue(id1 != id2, "Job IDs should be unique");
    }

    // ─── addTask ──────────────────────────────────────────────────────

    function _createTestJob() internal returns (uint256) {
        vm.prank(client);
        return marketplace.createJob{value: 0.01 ether}("Design and post flyers");
    }

    function test_addTask() public {
        uint256 jobId = _createTestJob();

        vm.prank(agentWallet);
        uint256 taskId = marketplace.addTask(jobId, "Design flyer", "Upload screenshot", 0.003 ether, 7200, 3);

        assertEq(taskId, 1);
        JobMarketplace.Task memory task = marketplace.getTask(1);
        assertEq(task.description, "Design flyer");
        assertEq(task.reward, 0.003 ether);
        assertEq(uint256(task.status), uint256(JobMarketplace.TaskStatus.Open));
        assertEq(task.sequenceIndex, 0);
    }

    function test_addTask_secondTaskPending() public {
        uint256 jobId = _createTestJob();

        vm.startPrank(agentWallet);
        marketplace.addTask(jobId, "Design flyer", "Upload screenshot", 0.003 ether, 7200, 3);
        uint256 taskId2 = marketplace.addTask(jobId, "Print flyers", "Upload photos", 0.004 ether, 14400, 3);
        vm.stopPrank();

        JobMarketplace.Task memory task2 = marketplace.getTask(taskId2);
        assertEq(uint256(task2.status), uint256(JobMarketplace.TaskStatus.Pending));
        assertEq(task2.sequenceIndex, 1);
    }

    function test_addTask_setsJobInProgress() public {
        uint256 jobId = _createTestJob();

        vm.prank(agentWallet);
        marketplace.addTask(jobId, "Design flyer", "Upload screenshot", 0.003 ether, 7200, 3);

        JobMarketplace.Job memory job = marketplace.getJob(jobId);
        assertEq(uint256(job.status), uint256(JobMarketplace.JobStatus.InProgress));
    }

    function test_addTask_revertExceedsBudget() public {
        uint256 jobId = _createTestJob();

        vm.prank(agentWallet);
        vm.expectRevert("Exceeds budget");
        marketplace.addTask(jobId, "Too expensive", "proof", 0.011 ether, 7200, 3);
    }

    function test_addTask_revertNotAgent() public {
        uint256 jobId = _createTestJob();

        vm.prank(client);
        vm.expectRevert("Not agent");
        marketplace.addTask(jobId, "Design flyer", "Upload screenshot", 0.003 ether, 7200, 3);
    }

    // ─── acceptTask ───────────────────────────────────────────────────

    function _createJobWithTask() internal returns (uint256 jobId, uint256 taskId) {
        jobId = _createTestJob();
        vm.prank(agentWallet);
        taskId = marketplace.addTask(jobId, "Design flyer", "Upload screenshot", 0.003 ether, 7200, 3);
    }

    function test_acceptTask() public {
        (uint256 jobId, uint256 taskId) = _createJobWithTask();

        vm.prank(worker1);
        marketplace.acceptTask(jobId, taskId);

        JobMarketplace.Task memory task = marketplace.getTask(taskId);
        assertEq(task.worker, worker1);
        assertEq(uint256(task.status), uint256(JobMarketplace.TaskStatus.Accepted));
    }

    function test_acceptTask_tracksWorkerTasks() public {
        (uint256 jobId, uint256 taskId) = _createJobWithTask();

        vm.prank(worker1);
        marketplace.acceptTask(jobId, taskId);

        uint256[] memory wTasks = marketplace.getWorkerTasks(worker1);
        assertEq(wTasks.length, 1);
        assertEq(wTasks[0], taskId);
    }

    function test_acceptTask_revertNotOpen() public {
        (uint256 jobId, uint256 taskId) = _createJobWithTask();

        vm.prank(worker1);
        marketplace.acceptTask(jobId, taskId);

        vm.prank(worker2);
        vm.expectRevert("Not open");
        marketplace.acceptTask(jobId, taskId);
    }

    function test_acceptTask_revertAgent() public {
        (uint256 jobId, uint256 taskId) = _createJobWithTask();

        vm.prank(agentWallet);
        vm.expectRevert("Agent cannot accept tasks");
        marketplace.acceptTask(jobId, taskId);
    }

    // ─── submitProof ──────────────────────────────────────────────────

    function _createJobAcceptTask() internal returns (uint256 jobId, uint256 taskId) {
        (jobId, taskId) = _createJobWithTask();
        vm.prank(worker1);
        marketplace.acceptTask(jobId, taskId);
    }

    function test_submitProof() public {
        (uint256 jobId, uint256 taskId) = _createJobAcceptTask();

        vm.prank(worker1);
        marketplace.submitProof(jobId, taskId, "ipfs://QmTest123");

        JobMarketplace.Task memory task = marketplace.getTask(taskId);
        assertEq(task.proofURI, "ipfs://QmTest123");
        assertEq(uint256(task.status), uint256(JobMarketplace.TaskStatus.PendingVerification));
    }

    function test_submitProof_revertNotWorker() public {
        (uint256 jobId, uint256 taskId) = _createJobAcceptTask();

        vm.prank(worker2);
        vm.expectRevert("Not assigned worker");
        marketplace.submitProof(jobId, taskId, "ipfs://QmTest123");
    }

    function test_submitProof_revertPastDeadline() public {
        (uint256 jobId, uint256 taskId) = _createJobAcceptTask();

        vm.warp(block.timestamp + 7201);

        vm.prank(worker1);
        vm.expectRevert("Past deadline");
        marketplace.submitProof(jobId, taskId, "ipfs://QmTest123");
    }

    function test_submitProof_revertEmpty() public {
        (uint256 jobId, uint256 taskId) = _createJobAcceptTask();

        vm.prank(worker1);
        vm.expectRevert("Empty proof");
        marketplace.submitProof(jobId, taskId, "");
    }

    // ─── approveTask ──────────────────────────────────────────────────

    function _submitProofForApproval() internal returns (uint256 jobId, uint256 taskId) {
        (jobId, taskId) = _createJobAcceptTask();
        vm.prank(worker1);
        marketplace.submitProof(jobId, taskId, "ipfs://QmFlyer123");
    }

    function test_approveTask() public {
        (uint256 jobId, uint256 taskId) = _submitProofForApproval();

        uint256 workerBalBefore = worker1.balance;

        vm.prank(agentWallet);
        marketplace.approveTask(jobId, taskId);

        JobMarketplace.Task memory task = marketplace.getTask(taskId);
        assertEq(uint256(task.status), uint256(JobMarketplace.TaskStatus.Completed));
        assertEq(task.deliverableURI, "ipfs://QmFlyer123");
        assertEq(worker1.balance, workerBalBefore + 0.003 ether);
    }

    function test_approveTask_opensNextTask() public {
        uint256 jobId = _createTestJob();
        vm.startPrank(agentWallet);
        uint256 t0 = marketplace.addTask(jobId, "Design", "proof", 0.003 ether, 7200, 3);
        uint256 t1 = marketplace.addTask(jobId, "Print", "proof", 0.004 ether, 14400, 3);
        vm.stopPrank();

        vm.prank(worker1);
        marketplace.acceptTask(jobId, t0);
        vm.prank(worker1);
        marketplace.submitProof(jobId, t0, "ipfs://QmDesign");

        vm.prank(agentWallet);
        marketplace.approveTask(jobId, t0);

        JobMarketplace.Task memory next = marketplace.getTask(t1);
        assertEq(uint256(next.status), uint256(JobMarketplace.TaskStatus.Open));
    }

    // ─── rejectProof ──────────────────────────────────────────────────

    function test_rejectProof_workerRetries() public {
        (uint256 jobId, uint256 taskId) = _submitProofForApproval();

        vm.prank(agentWallet);
        marketplace.rejectProof(jobId, taskId, "Blurry image");

        JobMarketplace.Task memory task = marketplace.getTask(taskId);
        assertEq(uint256(task.status), uint256(JobMarketplace.TaskStatus.Accepted));
        assertEq(task.retryCount, 1);
        assertEq(task.rejectionReason, "Blurry image");
    }

    function test_rejectProof_maxRetriesBootsWorker() public {
        uint256 jobId = _createTestJob();
        vm.prank(agentWallet);
        uint256 taskId = marketplace.addTask(jobId, "Design", "proof", 0.003 ether, 7200, 2);

        vm.prank(worker1);
        marketplace.acceptTask(jobId, taskId);

        // First submission + rejection
        vm.prank(worker1);
        marketplace.submitProof(jobId, taskId, "ipfs://bad1");
        vm.prank(agentWallet);
        marketplace.rejectProof(jobId, taskId, "Bad");

        // Second submission + rejection (maxRetries=2, so this boots the worker)
        vm.prank(worker1);
        marketplace.submitProof(jobId, taskId, "ipfs://bad2");
        vm.prank(agentWallet);
        marketplace.rejectProof(jobId, taskId, "Still bad");

        JobMarketplace.Task memory task = marketplace.getTask(taskId);
        assertEq(uint256(task.status), uint256(JobMarketplace.TaskStatus.Open));
        assertEq(task.worker, address(0));
    }

    // ─── completeJob ──────────────────────────────────────────────────

    function test_fullLifecycle() public {
        uint256 jobId = _createTestJob();

        vm.startPrank(agentWallet);
        uint256 t0 = marketplace.addTask(jobId, "Design", "proof", 0.003 ether, 7200, 3);
        uint256 t1 = marketplace.addTask(jobId, "Print", "proof", 0.004 ether, 14400, 3);
        vm.stopPrank();

        // Task 0: accept, submit, approve
        vm.prank(worker1);
        marketplace.acceptTask(jobId, t0);
        vm.prank(worker1);
        marketplace.submitProof(jobId, t0, "ipfs://design");
        vm.prank(agentWallet);
        marketplace.approveTask(jobId, t0);

        // Task 1: accept, submit, approve
        vm.prank(worker2);
        marketplace.acceptTask(jobId, t1);
        vm.prank(worker2);
        marketplace.submitProof(jobId, t1, "ipfs://photos");
        vm.prank(agentWallet);
        marketplace.approveTask(jobId, t1);

        // Complete job
        uint256 agentBalBefore = agentWallet.balance;
        vm.prank(agentWallet);
        marketplace.completeJob(jobId);

        JobMarketplace.Job memory job = marketplace.getJob(jobId);
        assertEq(uint256(job.status), uint256(JobMarketplace.JobStatus.Completed));
        assertEq(agentWallet.balance, agentBalBefore + 0.003 ether); // 0.01 - 0.003 - 0.004 = 0.003 profit

        assertEq(marketplace.totalJobsCompleted(), 1);
        assertEq(marketplace.totalEarnedByAgent(), 0.003 ether);
        assertEq(marketplace.totalPaidToWorkers(), 0.007 ether);
    }

    function test_completeJob_revertNotAllDone() public {
        (uint256 jobId, ) = _submitProofForApproval();

        vm.prank(agentWallet);
        vm.expectRevert("Not all tasks completed");
        marketplace.completeJob(jobId);
    }

    // ─── cancelJob ────────────────────────────────────────────────────

    function test_cancelJob_byClient() public {
        uint256 jobId = _createTestJob();
        uint256 clientBalBefore = client.balance;

        vm.prank(client);
        marketplace.cancelJob(jobId);

        JobMarketplace.Job memory job = marketplace.getJob(jobId);
        assertEq(uint256(job.status), uint256(JobMarketplace.JobStatus.Cancelled));
        assertEq(client.balance, clientBalBefore + 0.01 ether);
    }

    function test_cancelJob_byAgent() public {
        uint256 jobId = _createTestJob();

        vm.prank(agentWallet);
        marketplace.cancelJob(jobId);

        assertEq(uint256(marketplace.getJob(jobId).status), uint256(JobMarketplace.JobStatus.Cancelled));
    }

    function test_cancelJob_revertTaskAccepted() public {
        (uint256 jobId, uint256 taskId) = _createJobWithTask();
        vm.prank(worker1);
        marketplace.acceptTask(jobId, taskId);

        vm.prank(client);
        vm.expectRevert("Task already accepted");
        marketplace.cancelJob(jobId);
    }

    // ─── expireTask ───────────────────────────────────────────────────

    function test_expireTask() public {
        (uint256 jobId, uint256 taskId) = _createJobAcceptTask();

        vm.warp(block.timestamp + 7201);

        marketplace.expireTask(jobId, taskId);

        JobMarketplace.Task memory task = marketplace.getTask(taskId);
        assertEq(uint256(task.status), uint256(JobMarketplace.TaskStatus.Open));
        assertEq(task.worker, address(0));
    }

    function test_expireTask_revertNotExpired() public {
        (uint256 jobId, uint256 taskId) = _createJobAcceptTask();

        vm.expectRevert("Not expired");
        marketplace.expireTask(jobId, taskId);
    }

    // ─── View Functions ───────────────────────────────────────────────

    function test_getOpenTasks() public {
        uint256 jobId = _createTestJob();
        vm.startPrank(agentWallet);
        marketplace.addTask(jobId, "Design", "proof", 0.003 ether, 7200, 3);
        marketplace.addTask(jobId, "Print", "proof", 0.004 ether, 14400, 3);
        vm.stopPrank();

        JobMarketplace.Task[] memory open = marketplace.getOpenTasks();
        assertEq(open.length, 1);
        assertEq(open[0].description, "Design");
    }

    function test_getJobTasks() public {
        uint256 jobId = _createTestJob();
        vm.startPrank(agentWallet);
        marketplace.addTask(jobId, "Design", "proof1", 0.003 ether, 7200, 3);
        marketplace.addTask(jobId, "Print", "proof2", 0.004 ether, 14400, 3);
        vm.stopPrank();

        JobMarketplace.Task[] memory allTasks = marketplace.getJobTasks(jobId);
        assertEq(allTasks.length, 2);
        assertEq(allTasks[0].description, "Design");
        assertEq(allTasks[1].description, "Print");
    }

    function test_getPreviousDeliverable() public {
        uint256 jobId = _createTestJob();
        vm.startPrank(agentWallet);
        uint256 t0 = marketplace.addTask(jobId, "Design", "proof", 0.003 ether, 7200, 3);
        uint256 t1 = marketplace.addTask(jobId, "Print", "proof", 0.004 ether, 14400, 3);
        vm.stopPrank();

        vm.prank(worker1);
        marketplace.acceptTask(jobId, t0);
        vm.prank(worker1);
        marketplace.submitProof(jobId, t0, "ipfs://QmDesign");
        vm.prank(agentWallet);
        marketplace.approveTask(jobId, t0);

        string memory prev = marketplace.getPreviousDeliverable(jobId, t1);
        assertEq(prev, "ipfs://QmDesign");

        string memory firstPrev = marketplace.getPreviousDeliverable(jobId, t0);
        assertEq(firstPrev, "");
    }

    function test_getAgentStats() public {
        test_fullLifecycle();
        (uint256 completed, uint256 earned, uint256 paid, uint256 count) = marketplace.getAgentStats();
        assertEq(completed, 1);
        assertEq(earned, 0.003 ether);
        assertEq(paid, 0.007 ether);
        assertEq(count, 1);
    }
}
