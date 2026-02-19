// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract JobMarketplace is Ownable, ReentrancyGuard, Pausable {
    enum JobStatus { Created, InProgress, Completed, Cancelled }
    enum TaskStatus { Pending, Open, Accepted, PendingVerification, Completed, Cancelled }

    struct Job {
        uint256 id;
        address client;
        string description;
        uint256 totalBudget;
        uint256 totalCommitted;
        uint256 totalSpent;
        uint256 taskCount;
        JobStatus status;
        uint256 createdAt;
    }

    struct Task {
        uint256 id;
        uint256 jobId;
        uint256 sequenceIndex;
        address worker;
        string description;
        string proofRequirements;
        string deliverableURI;
        uint256 reward;
        uint256 deadline;
        uint256 maxRetries;
        uint256 retryCount;
        TaskStatus status;
        string proofURI;
        string rejectionReason;
    }

    address public agent;
    uint256 public nextJobId;
    uint256 public nextTaskId;
    mapping(uint256 => Job) public jobs;
    mapping(uint256 => Task) public tasks;
    mapping(uint256 => uint256[]) public jobTaskIds;
    mapping(address => uint256[]) public clientJobs;
    mapping(address => uint256[]) public workerTasks;

    uint256 public totalJobsCompleted;
    uint256 public totalEarnedByAgent;
    uint256 public totalPaidToWorkers;

    modifier onlyAgent() {
        require(msg.sender == agent, "Not agent");
        _;
    }

    event JobCreated(uint256 indexed jobId, address indexed client, uint256 budget, string description);
    event TaskAdded(uint256 indexed jobId, uint256 indexed taskId, uint256 sequenceIndex, uint256 reward);
    event TaskAvailable(uint256 indexed jobId, uint256 indexed taskId, string previousDeliverableURI);
    event TaskAccepted(uint256 indexed jobId, uint256 indexed taskId, address indexed worker);
    event ProofSubmitted(uint256 indexed jobId, uint256 indexed taskId, string proofURI);
    event TaskCompleted(uint256 indexed jobId, uint256 indexed taskId, address worker, uint256 payout);
    event ProofRejected(uint256 indexed jobId, uint256 indexed taskId, string reason);
    event TaskExpired(uint256 indexed jobId, uint256 indexed taskId, address previousWorker);
    event JobCompleted(uint256 indexed jobId, uint256 profit);
    event JobCancelled(uint256 indexed jobId, uint256 refund);

    constructor(address _agent) Ownable(msg.sender) {
        agent = _agent;
    }

    function setAgent(address _newAgent) external onlyOwner {
        require(_newAgent != address(0), "Zero address");
        agent = _newAgent;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ─── Client-Facing ────────────────────────────────────────────────

    function createJob(string calldata description) external payable whenNotPaused returns (uint256 jobId) {
        require(msg.value >= 0.0001 ether, "Minimum budget 0.0001 ETH");
        require(bytes(description).length > 0, "Empty description");

        jobId = nextJobId++;
        jobs[jobId] = Job({
            id: jobId,
            client: msg.sender,
            description: description,
            totalBudget: msg.value,
            totalCommitted: 0,
            totalSpent: 0,
            taskCount: 0,
            status: JobStatus.Created,
            createdAt: block.timestamp
        });
        clientJobs[msg.sender].push(jobId);

        emit JobCreated(jobId, msg.sender, msg.value, description);
    }

    // ─── Agent-Facing ─────────────────────────────────────────────────

    function addTask(
        uint256 jobId,
        string calldata description,
        string calldata proofRequirements,
        uint256 reward,
        uint256 deadlineOffset,
        uint256 maxRetries
    ) external onlyAgent whenNotPaused returns (uint256 taskId) {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Created || job.status == JobStatus.InProgress, "Job not active");
        require(job.totalCommitted + reward <= job.totalBudget, "Exceeds budget");

        taskId = nextTaskId++;
        uint256 seqIndex = jobTaskIds[jobId].length;

        uint256 actualDeadline = seqIndex == 0
            ? block.timestamp + deadlineOffset
            : deadlineOffset;

        tasks[taskId] = Task({
            id: taskId,
            jobId: jobId,
            sequenceIndex: seqIndex,
            worker: address(0),
            description: description,
            proofRequirements: proofRequirements,
            deliverableURI: "",
            reward: reward,
            deadline: actualDeadline,
            maxRetries: maxRetries > 0 ? maxRetries : 3,
            retryCount: 0,
            status: seqIndex == 0 ? TaskStatus.Open : TaskStatus.Pending,
            proofURI: "",
            rejectionReason: ""
        });

        jobTaskIds[jobId].push(taskId);
        job.totalCommitted += reward;
        job.taskCount++;

        if (job.status == JobStatus.Created) {
            job.status = JobStatus.InProgress;
        }

        emit TaskAdded(jobId, taskId, seqIndex, reward);
        if (seqIndex == 0) {
            emit TaskAvailable(jobId, taskId, "");
        }
    }

    function approveTask(uint256 jobId, uint256 taskId) external onlyAgent nonReentrant {
        Job storage job = jobs[jobId];
        Task storage task = tasks[taskId];

        require(job.status == JobStatus.InProgress, "Job not in progress");
        require(task.status == TaskStatus.PendingVerification, "No proof pending");
        require(task.jobId == jobId, "Task not in job");

        task.status = TaskStatus.Completed;
        task.deliverableURI = task.proofURI;
        job.totalSpent += task.reward;
        address worker = task.worker;
        uint256 reward = task.reward;

        uint256 nextSeq = task.sequenceIndex + 1;
        if (nextSeq < job.taskCount) {
            uint256 nextTaskId_ = jobTaskIds[jobId][nextSeq];
            Task storage nextTask = tasks[nextTaskId_];
            nextTask.status = TaskStatus.Open;
            nextTask.deadline = block.timestamp + nextTask.deadline;
            emit TaskAvailable(jobId, nextTaskId_, task.deliverableURI);
        }

        emit TaskCompleted(jobId, taskId, worker, reward);

        (bool success, ) = payable(worker).call{value: reward}("");
        require(success, "Payment failed");
    }

    function rejectProof(uint256 jobId, uint256 taskId, string calldata reason) external onlyAgent {
        Task storage task = tasks[taskId];
        require(task.jobId == jobId, "Task not in job");
        require(task.status == TaskStatus.PendingVerification, "No proof pending");

        task.retryCount++;
        task.rejectionReason = reason;

        if (task.retryCount >= task.maxRetries) {
            task.status = TaskStatus.Open;
            task.worker = address(0);
            task.proofURI = "";
            task.deadline = block.timestamp + 4 hours;

            string memory prevDeliverable = "";
            if (task.sequenceIndex > 0) {
                uint256 prevTaskId = jobTaskIds[jobId][task.sequenceIndex - 1];
                prevDeliverable = tasks[prevTaskId].deliverableURI;
            }

            emit ProofRejected(jobId, taskId, reason);
            emit TaskAvailable(jobId, taskId, prevDeliverable);
        } else {
            task.status = TaskStatus.Accepted;
            emit ProofRejected(jobId, taskId, reason);
        }
    }

    function completeJob(uint256 jobId) external onlyAgent nonReentrant {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.InProgress, "Job not in progress");

        for (uint256 i = 0; i < job.taskCount; i++) {
            require(
                tasks[jobTaskIds[jobId][i]].status == TaskStatus.Completed,
                "Not all tasks completed"
            );
        }

        job.status = JobStatus.Completed;
        uint256 profit = job.totalBudget - job.totalSpent;
        totalJobsCompleted++;
        totalEarnedByAgent += profit;
        totalPaidToWorkers += job.totalSpent;

        emit JobCompleted(jobId, profit);

        if (profit > 0) {
            (bool success, ) = payable(agent).call{value: profit}("");
            require(success, "Profit withdrawal failed");
        }
    }

    function cancelJob(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        require(msg.sender == agent || msg.sender == job.client, "Not authorized");
        require(job.status == JobStatus.Created || job.status == JobStatus.InProgress, "Not active");

        for (uint256 i = 0; i < job.taskCount; i++) {
            Task storage task = tasks[jobTaskIds[jobId][i]];
            require(
                task.status == TaskStatus.Pending || task.status == TaskStatus.Open,
                "Task already accepted"
            );
            task.status = TaskStatus.Cancelled;
        }

        job.status = JobStatus.Cancelled;
        uint256 refund = job.totalBudget;

        emit JobCancelled(jobId, refund);

        (bool success, ) = payable(job.client).call{value: refund}("");
        require(success, "Refund failed");
    }

    // ─── Worker-Facing ────────────────────────────────────────────────

    function acceptTask(uint256 jobId, uint256 taskId) external whenNotPaused {
        Task storage task = tasks[taskId];
        require(task.jobId == jobId, "Task not in job");
        require(task.status == TaskStatus.Open, "Not open");
        require(msg.sender != agent, "Agent cannot accept tasks");

        task.worker = msg.sender;
        task.status = TaskStatus.Accepted;
        workerTasks[msg.sender].push(taskId);

        emit TaskAccepted(jobId, taskId, msg.sender);
    }

    function submitProof(uint256 jobId, uint256 taskId, string calldata proofURI) external whenNotPaused {
        Task storage task = tasks[taskId];
        require(task.jobId == jobId, "Task not in job");
        require(task.status == TaskStatus.Accepted, "Not accepted");
        require(msg.sender == task.worker, "Not assigned worker");
        require(block.timestamp < task.deadline, "Past deadline");
        require(bytes(proofURI).length > 0, "Empty proof");

        task.proofURI = proofURI;
        task.status = TaskStatus.PendingVerification;

        emit ProofSubmitted(jobId, taskId, proofURI);
    }

    function expireTask(uint256 jobId, uint256 taskId) external nonReentrant {
        Task storage task = tasks[taskId];
        require(task.jobId == jobId, "Task not in job");
        require(block.timestamp >= task.deadline, "Not expired");
        require(task.status == TaskStatus.Accepted || task.status == TaskStatus.PendingVerification, "Not expirable");

        address previousWorker = task.worker;

        task.status = TaskStatus.Open;
        task.worker = address(0);
        task.proofURI = "";
        task.retryCount = 0;
        task.deadline = block.timestamp + 4 hours;

        string memory prevDeliverable = "";
        if (task.sequenceIndex > 0) {
            uint256 prevTaskId = jobTaskIds[jobId][task.sequenceIndex - 1];
            prevDeliverable = tasks[prevTaskId].deliverableURI;
        }

        emit TaskExpired(jobId, taskId, previousWorker);
        emit TaskAvailable(jobId, taskId, prevDeliverable);
    }

    // ─── View Functions ───────────────────────────────────────────────

    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }

    function getTask(uint256 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }

    function getClientJobs(address client) external view returns (uint256[] memory) {
        return clientJobs[client];
    }

    function getJobTasks(uint256 jobId) external view returns (Task[] memory) {
        Job storage job = jobs[jobId];
        Task[] memory result = new Task[](job.taskCount);
        for (uint256 i = 0; i < job.taskCount; i++) {
            result[i] = tasks[jobTaskIds[jobId][i]];
        }
        return result;
    }

    function getPreviousDeliverable(uint256 jobId, uint256 taskId) external view returns (string memory) {
        Task storage task = tasks[taskId];
        require(task.jobId == jobId, "Task not in job");
        if (task.sequenceIndex == 0) return "";
        uint256 prevTaskId = jobTaskIds[jobId][task.sequenceIndex - 1];
        return tasks[prevTaskId].deliverableURI;
    }

    function getWorkerTasks(address worker) external view returns (uint256[] memory) {
        return workerTasks[worker];
    }

    function getAgentStats() external view returns (
        uint256 _totalJobsCompleted,
        uint256 _totalEarnedByAgent,
        uint256 _totalPaidToWorkers,
        uint256 _nextJobId
    ) {
        return (totalJobsCompleted, totalEarnedByAgent, totalPaidToWorkers, nextJobId);
    }

    function getOpenTasks() external view returns (Task[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < nextTaskId; i++) {
            if (tasks[i].status == TaskStatus.Open) count++;
        }
        Task[] memory result = new Task[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < nextTaskId; i++) {
            if (tasks[i].status == TaskStatus.Open) result[idx++] = tasks[i];
        }
        return result;
    }
}
