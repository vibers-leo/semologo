import { handleLogoWalls } from '@/lib/logo-wall-store';

export const dynamic = 'force-dynamic';
export const GET = (request: Request) => handleLogoWalls(request);
export const POST = (request: Request) => handleLogoWalls(request);
export const PUT = (request: Request) => handleLogoWalls(request);
export const DELETE = (request: Request) => handleLogoWalls(request);
