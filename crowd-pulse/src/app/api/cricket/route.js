/**
 * Cricket Live Score API Route
 * 
 * Proxies requests to CricketData.org API (free tier).
 * Endpoints:
 *   GET /api/cricket              → list current live matches
 *   GET /api/cricket?matchId=xxx  → get live score for a specific match
 */

const API_KEY = process.env.CRICKET_API_KEY || '';
const BASE_URL = 'https://api.cricapi.com/v1';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get('matchId');
  const action = searchParams.get('action') || 'currentMatches';

  try {
    let url;
    let params = new URLSearchParams({ apikey: API_KEY });

    if (matchId) {
      // Get specific match info / scorecard
      url = `${BASE_URL}/match_scorecard`;
      params.append('id', matchId);
    } else if (action === 'currentMatches') {
      // List all current/live matches
      url = `${BASE_URL}/currentMatches`;
    } else if (action === 'matches') {
      // List upcoming matches
      url = `${BASE_URL}/matches`;
    }

    const res = await fetch(`${url}?${params.toString()}`, {
      next: { revalidate: 5 }, // Cache for 5 seconds
    });

    if (!res.ok) {
      // Rate limited or error
      if (res.status === 429) {
        return Response.json(
          { error: 'Rate limited. Please wait.', status: 429 },
          { status: 429 }
        );
      }
      throw new Error(`Cricket API error: ${res.status}`);
    }

    const data = await res.json();

    // Normalize the response for our frontend
    if (matchId && data.data) {
      const match = data.data;
      const normalized = {
        matchId: match.id,
        name: match.name,
        status: match.status,
        matchType: match.matchType,
        venue: match.venue,
        date: match.date,
        teams: match.teams || [],
        score: (match.score || []).map(s => ({
          team: s.r !== undefined ? (s.inning || '').replace(' Inning', '').replace(' 1', '').replace(' 2', '').trim() : '',
          inning: s.inning,
          runs: s.r,
          wickets: s.w,
          overs: s.o,
          display: `${s.r}/${s.w} (${s.o} ov)`,
        })),
        scorecard: match.scorecard || [],
        isLive: match.matchStarted && !match.matchEnded,
        dateTimeGMT: match.dateTimeGMT,
      };
      return Response.json({ data: normalized, timestamp: Date.now() });
    }

    // For match list
    if (data.data) {
      const matches = data.data
        .filter(m => m.matchStarted && !m.matchEnded)
        .map(m => ({
          matchId: m.id,
          name: m.name,
          status: m.status,
          matchType: m.matchType,
          venue: m.venue,
          teams: m.teams || [],
          score: (m.score || []).map(s => ({
            inning: s.inning,
            runs: s.r,
            wickets: s.w,
            overs: s.o,
            display: `${s.r}/${s.w} (${s.o} ov)`,
          })),
          isLive: m.matchStarted && !m.matchEnded,
          dateTimeGMT: m.dateTimeGMT,
        }));
      return Response.json({ data: matches, timestamp: Date.now() });
    }

    return Response.json({ data: [], timestamp: Date.now() });
  } catch (error) {
    console.error('Cricket API error:', error);
    return Response.json(
      { error: error.message, data: null },
      { status: 500 }
    );
  }
}
