import { NextRequest, NextResponse } from 'next/server';

const API_BASE = 'https://webintel.diyaaaa.in';

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') || '';
  const authHeader = request.headers.get('Authorization') || '';

  try {
    const res = await fetch(`${API_BASE}/${path}`, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') || '';
  const authHeader = request.headers.get('Authorization') || '';
  let body: any;
  try { body = await request.json(); } catch { body = {}; }

  try {
    const res = await fetch(`${API_BASE}/${path}`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') || '';
  const authHeader = request.headers.get('Authorization') || '';

  try {
    const res = await fetch(`${API_BASE}/${path}`, {
      method: 'DELETE',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
