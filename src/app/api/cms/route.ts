import { NextResponse } from 'next/server';
import {
  getCMSContent,
  updateHeroSlides,
  updateAboutSection,
  updateSiteInfo,
  updateReviews
} from '@/lib/data-service';

export async function GET() {
  try {
    const data = await getCMSContent();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, payload } = body;

    if (type === 'hero_carousel') {
      await updateHeroSlides(payload);
    } else if (type === 'about_section') {
      await updateAboutSection(payload);
    } else if (type === 'site_info') {
      await updateSiteInfo(payload);
    } else if (type === 'reviews') {
      await updateReviews(payload);
    } else {
      return NextResponse.json({ success: false, error: 'Invalid CMS section type' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'CMS updated successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
