import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path') || '';

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: 'Supabase configuration missing' },
      { status: 500 }
    );
  }

  try {
    // Forward the request to Supabase Storage API
    const supabaseResponse = await fetch(
      `${supabaseUrl}/storage/v1/${path}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          ...Object.fromEntries(request.headers.entries()),
        },
        body: request.body,
      }
    );

    // Forward the response back to the client
    const data = await supabaseResponse.json().catch(() => null);
    const responseHeaders = new Headers();

    // Copy important headers from Supabase response
    ['content-type', 'cache-control', 'expires'].forEach(header => {
      const value = supabaseResponse.headers.get(header);
      if (value) {
        responseHeaders.set(header, value);
      }
    });

    return NextResponse.json(data, {
      status: supabaseResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Storage proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Handle GET requests the same way
  return POST(request);
}

export async function PUT(request: NextRequest) {
  // Handle PUT requests the same way
  return POST(request);
}

export async function DELETE(request: NextRequest) {
  // Handle DELETE requests the same way
  return POST(request);
}
