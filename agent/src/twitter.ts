/**
 * Twitter bot: posts a tweet when a new job is created on TaskMaster.
 * Uses OAuth 1.0a user context (consumer key + access token). Bearer token alone cannot post.
 */

const MAX_TWEET_LENGTH = 280;

function getTwitterConfig(): {
  appKey: string;
  appSecret: string;
  accessToken: string;
  accessSecret: string;
} | null {
  const appKey =
    process.env.TWITTER_API_KEY ??
    process.env.TWITTER_CONSUMER_KEY ??
    process.env.TWITTER_CONSUMER_OAUTH_KEY;
  const appSecret =
    process.env.TWITTER_API_SECRET ??
    process.env.TWITTER_CONSUMER_SECRET ??
    process.env.TWITTER_CONSUMER_OAUTH_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

  if (appKey && appSecret && accessToken && accessSecret) {
    return { appKey, appSecret, accessToken, accessSecret };
  }
  return null;
}

/**
 * Build tweet text for a new job. Stays within 280 characters.
 */
function buildJobTweet(
  jobId: string,
  description: string,
  budgetEth: string,
): string {
  const oneLine = description.replace(/\s+/g, ' ').trim();
  const appUrl = process.env.TASKMASTER_APP_URL;
  const base = `🆕 New job #${jobId} on TaskMaster\n\n${oneLine}\n\nBudget: ${budgetEth} ETH`;
  const withLink = appUrl ? `${base}\n\n${appUrl}` : base;

  if (withLink.length <= MAX_TWEET_LENGTH) return withLink;

  // Truncate description to fit
  const budgetPart = `\n\nBudget: ${budgetEth} ETH`;
  const linkPart = appUrl ? `\n\n${appUrl}` : '';
  const overhead =
    `🆕 New job #${jobId} on TaskMaster\n\n`.length +
    budgetPart.length +
    linkPart.length;
  const maxDesc = MAX_TWEET_LENGTH - overhead - 3; // "..."
  const truncated =
    oneLine.length > maxDesc
      ? oneLine.slice(0, maxDesc).trimEnd() + '…'
      : oneLine;
  return `🆕 New job #${jobId} on TaskMaster\n\n${truncated}${budgetPart}${linkPart}`;
}

/**
 * Post a tweet for a newly created job. No-op if Twitter env vars are not set.
 * Errors are logged and not thrown so the orchestrator continues.
 */
export async function postJobCreatedTweet(
  jobId: string,
  description: string,
  budgetEth: string,
): Promise<void> {
  const creds = getTwitterConfig();
  if (!creds) {
    return;
  }

  const { TwitterApi } = await import('twitter-api-v2');
  const client = new TwitterApi(creds);

  const text = buildJobTweet(jobId, description, budgetEth);

  try {
    const result = await client.v2.tweet(text);
    console.log(
      `[twitter] Posted job #${jobId} tweet: ${(result as any)?.data?.id ?? 'ok'}`,
    );
  } catch (err: any) {
    const is403Permissions =
      err?.code === 403 &&
      (err?.data?.type ===
        'https://api.twitter.com/2/problems/oauth1-permissions' ||
        /oauth1.*permission/i.test(err?.data?.detail ?? ''));
    if (is403Permissions) {
      console.error(
        '[twitter] Post failed: app has Read-only permissions. In developer.x.com → your App → Settings → User authentication settings, set App permissions to "Read and write". Then regenerate your Access Token and Secret (old tokens keep the previous permission).',
      );
    } else {
      console.error('[twitter] Failed to post job tweet:', err);
    }
  }
}
