// Tab Sheet storage is handled client-side via localStorage.
// This route is a no-op stub kept for compatibility.
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json([])
}

export async function POST() {
  return NextResponse.json({ ok: true })
}

export async function PATCH() {
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  return NextResponse.json({ ok: true })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}
