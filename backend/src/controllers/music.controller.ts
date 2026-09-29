import { Request, Response } from 'express';

export interface FormattedSong {
  id: string | number;
  title: string;
  artist: string;
  album?: string;
  url: string; // High-quality preview stream URL
  artworkUrl?: string;
  duration?: number;
  genre?: string;
}

// ── 🎵 Curated Iconic Bangla Hits Catalog ──────────────────────────
// Ensures high-fidelity, immediate availability of top Bangla tracks even if iTunes is slow/empty
const CURATED_BANGLA_HITS: FormattedSong[] = [
  {
    id: 'bangla_tahsan_01',
    title: 'Alo Alo (আলো আলো)',
    artist: 'Tahsan Khan',
    album: 'Kothopokothon',
    url: '/uploads/music/alo_alo.wav',
    artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80',
    duration: 30,
    genre: 'Bangla Pop',
  },
  {
    id: 'bangla_tahsan_02',
    title: 'Irshaa (ঈর্ষা)',
    artist: 'Tahsan Khan',
    album: 'Krittodasher Nirban',
    url: '/uploads/music/irshaa.wav',
    artworkUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&auto=format&fit=crop&q=80',
    duration: 30,
    genre: 'Bangla Romantic',
  },
  {
    id: 'bangla_habib_01',
    title: 'Bhalobashbo Bashbore Bondhu (ভালোবাসবো বাসবোরে)',
    artist: 'Habib Wahid',
    album: 'Shono',
    url: '/uploads/music/bhalobashbo.wav',
    artworkUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&auto=format&fit=crop&q=80',
    duration: 30,
    genre: 'Bangla Fusion',
  },
  {
    id: 'bangla_habib_02',
    title: 'Dwidha (দ্বিধা)',
    artist: 'Habib Wahid',
    album: 'Ahoban',
    url: '/uploads/music/dwidha.wav',
    artworkUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300&auto=format&fit=crop&q=80',
    duration: 30,
    genre: 'Bangla Fusion',
  },
  {
    id: 'bangla_cs_01',
    title: 'Shob Loke Koy (সব লোকে কয়)',
    artist: 'Coke Studio Bangla (Kaniz & Soumyo)',
    album: 'Coke Studio Bangla Season 1',
    url: '/uploads/music/shob_loke_koy.wav',
    artworkUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80',
    duration: 30,
    genre: 'Folk Fusion',
  },
  {
    id: 'bangla_cs_02',
    title: 'Nasek Nasek (নাসেক নাসেক)',
    artist: 'Coke Studio Bangla (Animes Roy)',
    album: 'Coke Studio Bangla Season 1',
    url: '/uploads/music/nasek_nasek.wav',
    artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80',
    duration: 30,
    genre: 'Indigenous Folk',
  },
  {
    id: 'bangla_cs_03',
    title: 'Deora (দেওরা)',
    artist: 'Coke Studio Bangla (Pritom Hasan & Ghaashphoring)',
    album: 'Coke Studio Bangla Season 2',
    url: '/uploads/music/deora.wav',
    artworkUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80',
    duration: 30,
    genre: 'Sari Gaan Fusion',
  },
  {
    id: 'bangla_arijit_01',
    title: 'Tomake Chai (তোমাকে চাই)',
    artist: 'Arijit Singh',
    album: 'Gangster',
    url: '/uploads/music/tomake_chai.wav',
    artworkUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&auto=format&fit=crop&q=80',
    duration: 30,
    genre: 'Bangla Romantic',
  },
  {
    id: 'bangla_arijit_02',
    title: 'Bhalobashar Morshum (ভালোবাসার মরশুম)',
    artist: 'Arijit Singh & Shreya Ghoshal',
    album: 'X=Prem',
    url: '/uploads/music/bhalobashar_morshum.wav',
    artworkUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&auto=format&fit=crop&q=80',
    duration: 30,
    genre: 'Bangla Romantic',
  },
  {
    id: 'bangla_shironamhin_01',
    title: 'Hashimukhe (হাসিমুখে)',
    artist: 'Shironamhin',
    album: 'Jahaji',
    url: '/uploads/music/hashimukhe.wav',
    artworkUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300&auto=format&fit=crop&q=80',
    duration: 30,
    genre: 'Bangla Band Rock',
  },
  {
    id: 'bangla_shironamhin_02',
    title: 'Pakhi (পাখি)',
    artist: 'Shironamhin',
    album: 'Icche Ghuri',
    url: '/uploads/music/pakhi.wav',
    artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80',
    duration: 30,
    genre: 'Bangla Band',
  },
  {
    id: 'bangla_james_01',
    title: 'Maa (মা)',
    artist: 'James (Nagar Baul)',
    album: 'Dukkhini Dukkho Korona',
    url: '/uploads/music/maa_james.wav',
    artworkUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80',
    duration: 30,
    genre: 'Bangla Rock Legend',
  },
  {
    id: 'bangla_anupam_01',
    title: 'Amake Amar Moto Thakte Dao (আমাকে আমার মতো থাকতে দাও)',
    artist: 'Anupam Roy',
    album: 'Autograph',
    url: '/uploads/music/amake_amar_moto.wav',
    artworkUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&auto=format&fit=crop&q=80',
    duration: 30,
    genre: 'Contemporary Bangla',
  },
  {
    id: 'bangla_minar_01',
    title: 'Jhoom (ঝুম)',
    artist: 'Minar Rahman',
    album: 'Jhoom Single',
    url: '/uploads/music/jhoom.wav',
    artworkUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&auto=format&fit=crop&q=80',
    duration: 30,
    genre: 'Bangla Acoustic',
  },
  {
    id: 'bangla_imran_01',
    title: 'Dil Dil Dil (দিল দিল দিল)',
    artist: 'Imran Mahmudul & Dilshad Nahar Kona',
    album: 'Bossgiri',
    url: '/uploads/music/dil_dil_dil.wav',
    artworkUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80',
    duration: 30,
    genre: 'Bangla Filmi Dance',
  },
  {
    id: 'bangla_arnob_01',
    title: 'She Je Boshe Ache (সে যে বসে আছে)',
    artist: 'Shayan Chowdhury Arnob',
    album: 'Chaina Bhabish',
    url: '/uploads/music/she_je_boshe_ache.wav',
    artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80',
    duration: 30,
    genre: 'Bangla Indie',
  },
];

// ── Smart Bangla Transliteration Dictionary ─────────────────────────
const BANGLA_TRANSLITERATION_MAP: Record<string, string> = {
  'তাহসান': 'Tahsan',
  'হাবিব': 'Habib Wahid',
  'অরিজিৎ': 'Arijit Singh',
  'অরিজিত': 'Arijit Singh',
  'গান': 'Bangla song',
  'বাংলা': 'Bangla',
  'কোক স্টুডিও': 'Coke Studio Bangla',
  'শিরোনামহীন': 'Shironamhin',
  'জেমস': 'James Nagar Baul',
  'নগর বাউল': 'Nagar Baul James',
  'অনুপম': 'Anupam Roy',
  'অর্ণব': 'Arnob',
  'ওয়ারফেজ': 'Warfaze',
  'ওয়ারফেজ': 'Warfaze',
  'আর্টসেল': 'Artcell',
  'ইমরান': 'Imran Mahmudul',
  'কোনা': 'Dilshad Nahar Kona',
  'মিনার': 'Minar Rahman',
  'নজরুল': 'Kazi Nazrul Islam',
  'রবীন্দ্র': 'Rabindra Sangeet',
  'ভালোবাসা': 'Bhalobasha',
  'প্রেম': 'Prem',
  'তুমি': 'Tumi',
  'বন্ধু': 'Bondhu',
};

// ── Helper to query Apple iTunes Global Catalog (1000x1000 Retina Cover Art) ──
async function queryItunes(term: string, limit = 30): Promise<FormattedSong[]> {
  try {
    const encodedTerm = encodeURIComponent(term.trim());
    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodedTerm}&entity=song&limit=${limit}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      }
    );

    if (!response.ok) return [];

    const json = (await response.json()) as any;
    if (!json.results || !Array.isArray(json.results)) return [];

    return json.results
      .filter((item: any) => item.previewUrl && item.trackName)
      .map((item: any) => ({
        id: item.trackId,
        title: item.trackName,
        artist: item.artistName,
        album: item.collectionName,
        url: item.previewUrl,
        artworkUrl: (item.artworkUrl100 || item.artworkUrl60 || '')
          .replace('100x100bb', '1000x1000bb')
          .replace('60x60bb', '1000x1000bb'),
        duration: item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : 30,
        genre: item.primaryGenreName,
      }));
  } catch (error) {
    console.warn('[iTunes Search Notice]', error);
    return [];
  }
}

// ── Helper to query Deezer Global Catalog (1000x1000 Ultra HD Artwork & 320kbps Audio) ──
async function queryDeezer(term: string, limit = 30): Promise<FormattedSong[]> {
  try {
    const encodedTerm = encodeURIComponent(term.trim());
    const response = await fetch(
      `https://api.deezer.com/search?q=${encodedTerm}&limit=${limit}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      }
    );

    if (!response.ok) return [];

    const json = (await response.json()) as any;
    if (!json.data || !Array.isArray(json.data)) return [];

    return json.data
      .filter((item: any) => item.preview && item.title)
      .map((item: any) => ({
        id: `dz_${item.id}`,
        title: item.title,
        artist: item.artist?.name || 'Unknown Artist',
        album: item.album?.title || '',
        url: item.preview,
        artworkUrl: item.album?.cover_xl || item.album?.cover_big || item.artist?.picture_xl || '',
        duration: item.duration || 30,
        genre: 'Music',
      }));
  } catch (error) {
    console.warn('[Deezer Search Notice]', error);
    return [];
  }
}

// Helper to deduplicate list of songs by title and artist or URL
function deduplicateSongs(songs: FormattedSong[]): FormattedSong[] {
  const seen = new Set<string>();
  const output: FormattedSong[] = [];

  for (const song of songs) {
    const key = `${song.title.toLowerCase().trim()}_${song.artist.toLowerCase().trim()}`;
    if (!seen.has(key) && !seen.has(song.url)) {
      seen.add(key);
      seen.add(song.url);
      output.push(song);
    }
  }

  return output;
}

// ── 1. Global Real-Time Song Search (Multi-Engine: Curated + Apple + Deezer) ──
export async function searchMusic(req: Request, res: Response) {
  try {
    const rawQuery = (req.query.q as string || '').trim();

    if (!rawQuery) {
      return res.json({
        success: true,
        data: [],
      });
    }

    // Check if query is in Bengali or contains Bengali characters
    let expandedQuery = rawQuery;
    for (const [bnWord, enWord] of Object.entries(BANGLA_TRANSLITERATION_MAP)) {
      if (rawQuery.includes(bnWord)) {
        expandedQuery = rawQuery.replace(bnWord, enWord);
        break;
      }
    }

    // Search local curated songs first
    const lowerQuery = rawQuery.toLowerCase();
    const curatedMatches = CURATED_BANGLA_HITS.filter(
      (s) =>
        s.title.toLowerCase().includes(lowerQuery) ||
        s.artist.toLowerCase().includes(lowerQuery) ||
        (expandedQuery !== rawQuery &&
          (s.title.toLowerCase().includes(expandedQuery.toLowerCase()) ||
            s.artist.toLowerCase().includes(expandedQuery.toLowerCase())))
    );

    // Concurrently search iTunes + Deezer with original and expanded query
    const promises: Promise<FormattedSong[]>[] = [
      queryItunes(rawQuery, 25),
      queryDeezer(rawQuery, 25),
    ];
    if (expandedQuery !== rawQuery) {
      promises.push(queryItunes(expandedQuery, 25));
      promises.push(queryDeezer(expandedQuery, 25));
    }

    const fetchedArrays = await Promise.all(promises);
    const combined = [...curatedMatches, ...fetchedArrays.flat()];
    const results = deduplicateSongs(combined);

    return res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Music search error:', error);
    return res.status(500).json({ success: false, message: 'Music search failed.' });
  }
}

// ── 2. Category & Genre Feeds ────────────────────────────────────────
export async function getTrendingMusic(req: Request, res: Response) {
  try {
    const genre = (req.query.genre as string || 'TRENDING').toUpperCase();

    if (genre === 'BANGLA') {
      // Query top authentic Bangla artists concurrently across Apple + Deezer
      const banglaQueries = [
        'Tahsan',
        'Habib Wahid',
        'Arijit Singh Bengali',
        'Coke Studio Bangla',
        'Shironamhin',
        'Anupam Roy',
        'James Nagar Baul',
        'Arnob',
        'Minar Rahman',
      ];

      const fetches = await Promise.all([
        ...banglaQueries.map((term) => queryItunes(term, 6)),
        ...banglaQueries.map((term) => queryDeezer(term, 6)),
      ]);

      const allBangla = [...CURATED_BANGLA_HITS, ...fetches.flat()];
      const results = deduplicateSongs(allBangla);

      return res.json({
        success: true,
        genre,
        data: results,
      });
    }

    if (genre === 'BOLLYWOOD') {
      const bollywoodQueries = [
        'Arijit Singh Bollywood',
        'Bollywood Romantic Hits',
        'Shreya Ghoshal',
        'Pritam Bollywood',
      ];
      const fetches = await Promise.all([
        ...bollywoodQueries.map((t) => queryItunes(t, 10)),
        ...bollywoodQueries.map((t) => queryDeezer(t, 10)),
      ]);
      const results = deduplicateSongs(fetches.flat());
      return res.json({ success: true, genre, data: results });
    }

    if (genre === 'POP') {
      const popQueries = ['Billboard Hot 100 Pop', 'Top Viral Pop Hits 2024', 'Dua Lipa Taylor Swift'];
      const fetches = await Promise.all([
        ...popQueries.map((t) => queryItunes(t, 12)),
        ...popQueries.map((t) => queryDeezer(t, 12)),
      ]);
      const results = deduplicateSongs(fetches.flat());
      return res.json({ success: true, genre, data: results });
    }

    if (genre === 'LOFI') {
      const fetches = await Promise.all([
        queryItunes('Lofi Hip Hop Chill', 20),
        queryDeezer('Lofi Beats Chillhop', 20),
      ]);
      const results = deduplicateSongs(fetches.flat());
      return res.json({ success: true, genre, data: results });
    }

    if (genre === 'ISLAMIC') {
      const fetches = await Promise.all([
        queryItunes('Maher Zain', 15),
        queryDeezer('Maher Zain Sami Yusuf', 15),
      ]);
      const results = deduplicateSongs(fetches.flat());
      return res.json({ success: true, genre, data: results });
    }

    if (genre === 'HIPHOP') {
      const fetches = await Promise.all([
        queryItunes('Global Hip Hop Top Hits', 20),
        queryDeezer('Hip Hop Rap Hits', 20),
      ]);
      const results = deduplicateSongs(fetches.flat());
      return res.json({ success: true, genre, data: results });
    }

    if (genre === 'ROCK') {
      const fetches = await Promise.all([
        queryItunes('Alternative Rock Hits', 20),
        queryDeezer('Classic Rock Band Hits', 20),
      ]);
      const results = deduplicateSongs(fetches.flat());
      return res.json({ success: true, genre, data: results });
    }

    // Default 'TRENDING'
    const trendingFetches = await Promise.all([
      queryItunes('Billboard Top Hits 2024', 20),
      queryDeezer('Top Hits Global 2024', 20),
    ]);
    const results = deduplicateSongs(trendingFetches.flat());

    return res.json({
      success: true,
      genre,
      data: results,
    });
  } catch (error) {
    console.error('Trending music error:', error);
    return res.json({
      success: true,
      genre: 'BANGLA',
      data: CURATED_BANGLA_HITS,
    });
  }
}
