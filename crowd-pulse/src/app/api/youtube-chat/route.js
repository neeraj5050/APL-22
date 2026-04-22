/**
 * YouTube Live Chat API Route
 * 
 * Proxies requests to YouTube Data API v3 for live chat messages.
 * Endpoints:
 *   GET /api/youtube-chat?videoId=xxx                  → get liveChatId
 *   GET /api/youtube-chat?chatId=xxx&pageToken=xxx     → get chat messages
 */

const YT_API_KEY = process.env.YOUTUBE_API_KEY || '';
const YT_BASE = 'https://www.googleapis.com/youtube/v3';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');
  const chatId = searchParams.get('chatId');
  const pageToken = searchParams.get('pageToken');

  try {
    // Step 1: Get liveChatId from a video
    if (videoId && !chatId) {
      const url = `${YT_BASE}/videos?part=liveStreamingDetails,snippet&id=${videoId}&key=${YT_API_KEY}`;
      const res = await fetch(url);

      if (!res.ok) {
        if (res.status === 403) {
          return Response.json({ error: 'YouTube API quota exceeded', status: 403 }, { status: 403 });
        }
        throw new Error(`YouTube API error: ${res.status}`);
      }

      const data = await res.json();
      const video = data.items?.[0];

      if (!video) {
        return Response.json({ error: 'Video not found', data: null }, { status: 404 });
      }

      const liveChatId = video.liveStreamingDetails?.activeLiveChatId;
      if (!liveChatId) {
        return Response.json({
          error: 'No active live chat for this video',
          data: {
            title: video.snippet?.title,
            channelTitle: video.snippet?.channelTitle,
            isLive: !!video.liveStreamingDetails?.actualStartTime && !video.liveStreamingDetails?.actualEndTime,
            liveChatId: null,
          },
        }, { status: 200 });
      }

      return Response.json({
        data: {
          liveChatId,
          title: video.snippet?.title,
          channelTitle: video.snippet?.channelTitle,
          isLive: true,
        },
        timestamp: Date.now(),
      });
    }

    // Step 2: Fetch live chat messages
    if (chatId) {
      let url = `${YT_BASE}/liveChat/messages?liveChatId=${chatId}&part=snippet,authorDetails&maxResults=200&key=${YT_API_KEY}`;
      if (pageToken) {
        url += `&pageToken=${pageToken}`;
      }

      const res = await fetch(url);

      if (!res.ok) {
        if (res.status === 403) {
          return Response.json({ error: 'YouTube API quota exceeded', status: 403 }, { status: 403 });
        }
        throw new Error(`YouTube Chat API error: ${res.status}`);
      }

      const data = await res.json();

      const messages = (data.items || []).map(item => ({
        id: item.id,
        text: item.snippet?.displayMessage || item.snippet?.textMessageDetails?.messageText || '',
        author: item.authorDetails?.displayName || 'Anonymous',
        authorChannelId: item.authorDetails?.channelId || '',
        profileImageUrl: item.authorDetails?.profileImageUrl || '',
        isModerator: item.authorDetails?.isChatModerator || false,
        isOwner: item.authorDetails?.isChatOwner || false,
        isMember: item.authorDetails?.isChatSponsor || false,
        publishedAt: item.snippet?.publishedAt,
        type: item.snippet?.type, // textMessageEvent, superChatEvent, etc.
        superChatAmount: item.snippet?.superChatDetails?.amountDisplayString || null,
      }));

      return Response.json({
        data: {
          messages,
          nextPageToken: data.nextPageToken || null,
          pollingIntervalMs: data.pollingIntervalMillis || 5000,
          totalResults: data.pageInfo?.totalResults || 0,
        },
        timestamp: Date.now(),
      });
    }

    return Response.json({ error: 'Provide videoId or chatId parameter', data: null }, { status: 400 });
  } catch (error) {
    console.error('YouTube Chat API error:', error);
    return Response.json(
      { error: error.message, data: null },
      { status: 500 }
    );
  }
}
