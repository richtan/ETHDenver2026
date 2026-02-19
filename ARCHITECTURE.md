# How TaskMaster Works

## The Big Picture

TaskMaster is an autonomous AI agent that acts as a middleman between **clients** who have complex real-world jobs and **workers** who get paid in ETH to complete them. The agent breaks down big jobs into steps, hires humans for each step, verifies the work using AI vision, and keeps a profit margin to fund its own existence.

## From Each User's Perspective

### The Client (someone with a complex task)

You come to the site with a job you need done — say, "design a flyer for my product and post 100 copies around the convention center." You describe what you want, attach a budget in ETH, and submit it. That's it. You walk away.

Behind the scenes, the AI agent takes your job, figures out the steps needed (design the flyer first, then print and post it), and handles hiring people to do each step in order. You can come back anytime and see the progress of your job — which steps are done, which are in progress, and what the deliverables look like.

### The Worker (someone looking to earn ETH)

You browse a list of available tasks — things like "design a promotional flyer" or "post 100 flyers around the convention center." Each task shows what's needed, what proof you have to submit, how much it pays, and the deadline.

You pick a task, do the work, then come back and upload proof (usually a photo). The AI reviews your proof automatically. If it's good, you get paid instantly. If not, it tells you why and you can retry.

For sequential tasks, you also see what the previous person delivered — so if you're posting flyers, you can see the flyer design from step 1.

### The AI Agent (the autonomous middleman)

The agent sits between clients and workers. It:

1. Takes a complex job and breaks it into ordered steps
2. Posts each step as a task with a reward and deadline
3. Waits for a human to accept and complete each step
4. Verifies the work using AI vision (checks photos for fraud, quality, completeness)
5. Pays the worker if approved, or explains what's wrong if not
6. Moves on to the next step
7. Keeps the profit margin (what the client paid minus what workers earned) to pay for its own AI and blockchain costs

### The Dashboard (public transparency)

Anyone can visit the dashboard and watch everything happening in real time — a live feed of the agent's decisions, every blockchain transaction, how many jobs it's completed, how much revenue vs. costs, and whether it's profitable (self-sustaining). This is the "proof" that the agent is real and running autonomously.

## Money Flow

```
Client pays ETH into smart contract
        │
        ▼
Agent breaks job into tasks, sets rewards
        │
        ▼
Workers complete tasks and submit proof
        │
        ▼
Agent verifies proof with AI vision
        │
        ├── Approved → Worker gets paid from escrow
        │
        └── Rejected → Worker gets feedback, can retry
        
After all tasks complete:
        │
        ▼
Agent keeps the remaining margin (client budget minus worker payments)
        │
        ▼
Profit covers the agent's own costs (AI API calls, gas fees, hosting)
```

## Self-Sustainability

The agent is designed to pay for itself. Every job it completes earns a profit margin. That margin covers:

- **AI costs** — OpenAI API calls for job decomposition and proof verification
- **Gas fees** — blockchain transaction costs on Base
- **Hosting** — server compute for running the agent

The public dashboard tracks this in real time, showing whether revenue exceeds operating costs.
