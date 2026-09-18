'use client';

import { useState, useEffect } from 'react';
import { HeroSlide, AboutSectionData, SiteInfo, Review } from '@/types';
import {
  Image as ImageIcon,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Sliders,
  Info,
  MapPin,
  Phone,
  MessageCircle,
  Clock,
  Sparkles,
  Check,
  Star,
  ShieldCheck,
  Edit2,
  Navigation,
  FileText,
  Tag,
  AlertCircle
} from 'lucide-react';
import { INITIAL_REVIEWS } from '@/lib/mock-data';

interface AdminCMSProps {
  heroSlides: HeroSlide[];
  aboutData: AboutSectionData;
  siteInfo: SiteInfo;
  reviews?: Review[];
  onRefresh: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export default function AdminCMS({
  heroSlides: initialSlides,
  aboutData: initialAbout,
  siteInfo: initialSite,
  reviews: initialReviews = INITIAL_REVIEWS,
  onRefresh,
  showToast,
}: AdminCMSProps) {
  const [activeSubTab, setActiveSubTab] = useState<'hero' | 'about' | 'site' | 'reviews' | 'policies'>('hero');

  // Hero state
  const [slides, setSlides] = useState<HeroSlide[]>(initialSlides);
  const [savingHero, setSavingHero] = useState(false);

  // About state
  const [about, setAbout] = useState<AboutSectionData>(initialAbout);
  const [savingAbout, setSavingAbout] = useState(false);

  // Site info state
  const [site, setSite] = useState<SiteInfo>(initialSite);
  const [savingSite, setSavingSite] = useState(false);

  // Reviews state
  const [reviewsList, setReviewsList] = useState<Review[]>(initialReviews);
  const [savingReviews, setSavingReviews] = useState(false);
  const [isAddingReview, setIsAddingReview] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [reviewForm, setReviewForm] = useState<Partial<Review>>({
    author_name: '',
    author_location: '',
    rating: 5,
    review_text: '',
    review_date: 'Recently',
    is_featured: true,
  });

  // Policies & Amenities state
  const [newPolicyTitle, setNewPolicyTitle] = useState('');
  const [newPolicyDesc, setNewPolicyDesc] = useState('');
  const [isAddingPolicy, setIsAddingPolicy] = useState(false);
  const [newAmenityInput, setNewAmenityInput] = useState('');

  // Keep state synchronized when parent fetches fresh data
  useEffect(() => {
    if (initialSlides && initialSlides.length > 0) {
      setSlides(initialSlides);
    }
  }, [initialSlides]);

  useEffect(() => {
    if (initialAbout && initialAbout.headline) {
      setAbout(initialAbout);
    }
  }, [initialAbout]);

  useEffect(() => {
    if (initialSite && initialSite.name) {
      setSite(initialSite);
    }
  }, [initialSite]);

  useEffect(() => {
    if (initialReviews && initialReviews.length > 0) {
      setReviewsList(initialReviews);
    }
  }, [initialReviews]);

  // New slide form modal state
  const [newSlide, setNewSlide] = useState<HeroSlide>({
    id: '',
    image: '',
    title: '',
    subtitle: '',
    badge: 'Mountain Getaway',
  });
  const [isAddingSlide, setIsAddingSlide] = useState(false);

  // ==========================================
  // HERO CAROUSEL ACTIONS
  // ==========================================
  const handleMoveSlide = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= slides.length) return;
    const updated = [...slides];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setSlides(updated);
  };

  const handleDeleteSlide = (id: string) => {
    if (slides.length <= 1) {
      showToast('You must keep at least one hero slide', 'error');
      return;
    }
    setSlides(slides.filter((s) => s.id !== id));
  };

  const handleUpdateSlideField = (index: number, field: keyof HeroSlide, value: string) => {
    const updated = [...slides];
    updated[index] = { ...updated[index], [field]: value };
    setSlides(updated);
  };

  const handleAddSlide = () => {
    if (!newSlide.image || !newSlide.title) {
      showToast('Slide image URL and title are required', 'error');
      return;
    }
    const created: HeroSlide = {
      ...newSlide,
      id: 'slide-' + Date.now(),
    };
    setSlides([...slides, created]);
    setNewSlide({
      id: '',
      image: '',
      title: '',
      subtitle: '',
      badge: 'Boutique Comfort',
    });
    setIsAddingSlide(false);
  };

  const handleSaveHeroSlides = async () => {
    setSavingHero(true);
    try {
      const res = await fetch('/api/cms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'hero_carousel',
          payload: slides,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('Hero Carousel slides saved successfully!');
        onRefresh();
      } else {
        showToast('Failed to save hero slides', 'error');
      }
    } catch {
      showToast('Error saving hero carousel', 'error');
    } finally {
      setSavingHero(false);
    }
  };

  // ==========================================
  // ABOUT SECTION ACTIONS
  // ==========================================
  const handleSaveAbout = async () => {
    setSavingAbout(true);
    try {
      const res = await fetch('/api/cms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'about_section',
          payload: about,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('About section content saved successfully!');
        onRefresh();
      } else {
        showToast('Failed to save about section', 'error');
      }
    } catch {
      showToast('Error saving about section', 'error');
    } finally {
      setSavingAbout(false);
    }
  };

  const handleUpdateStat = (index: number, field: 'value' | 'label', val: string) => {
    const nextStats = [...about.stats];
    nextStats[index] = { ...nextStats[index], [field]: val };
    setAbout({ ...about, stats: nextStats });
  };

  const handleUpdateHighlight = (index: number, field: 'title' | 'desc', val: string) => {
    const nextH = [...about.highlights];
    nextH[index] = { ...nextH[index], [field]: val };
    setAbout({ ...about, highlights: nextH });
  };

  // ==========================================
  // SITE INFO ACTIONS
  // ==========================================
  const handleSaveSite = async () => {
    setSavingSite(true);
    try {
      const res = await fetch('/api/cms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'site_info',
          payload: site,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('Site info & contact details saved successfully!');
        onRefresh();
      } else {
        showToast('Failed to save site info', 'error');
      }
    } catch {
      showToast('Error saving site info', 'error');
    } finally {
      setSavingSite(false);
    }
  };

  // ==========================================
  // CUSTOMER REVIEWS ACTIONS
  // ==========================================
  const handleSaveAllReviews = async (updatedList?: Review[]) => {
    setSavingReviews(true);
    const payloadToSave = updatedList || reviewsList;
    try {
      const res = await fetch('/api/cms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'reviews',
          payload: payloadToSave,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('Guest reviews saved and updated on website!');
        onRefresh();
      } else {
        showToast('Failed to save reviews', 'error');
      }
    } catch {
      showToast('Error saving reviews', 'error');
    } finally {
      setSavingReviews(false);
    }
  };

  const handleAddOrEditReview = () => {
    if (!reviewForm.author_name?.trim() || !reviewForm.review_text?.trim()) {
      showToast('Author name and review comment text are required', 'error');
      return;
    }

    let updated: Review[];
    if (editingReview) {
      updated = reviewsList.map((r) =>
        r.id === editingReview.id ? ({ ...r, ...reviewForm } as Review) : r
      );
      showToast(`Updated review from ${reviewForm.author_name}`);
    } else {
      const newEntry: Review = {
        id: 'rev-' + Date.now(),
        author_name: reviewForm.author_name.trim(),
        author_location: reviewForm.author_location?.trim() || 'Verified Guest',
        rating: Number(reviewForm.rating) || 5,
        review_text: reviewForm.review_text.trim(),
        review_date: reviewForm.review_date?.trim() || 'Recently',
        is_featured: reviewForm.is_featured ?? true,
      };
      updated = [newEntry, ...reviewsList];
      showToast(`Added review from ${newEntry.author_name}`);
    }

    setReviewsList(updated);
    handleSaveAllReviews(updated);
    setIsAddingReview(false);
    setEditingReview(null);
    setReviewForm({
      author_name: '',
      author_location: '',
      rating: 5,
      review_text: '',
      review_date: 'Recently',
      is_featured: true,
    });
  };

  const handleDeleteReview = (id: string) => {
    const updated = reviewsList.filter((r) => r.id !== id);
    setReviewsList(updated);
    handleSaveAllReviews(updated);
    showToast('Review removed');
  };

  const handleToggleFeaturedReview = (id: string) => {
    const updated = reviewsList.map((r) =>
      r.id === id ? { ...r, is_featured: !r.is_featured } : r
    );
    setReviewsList(updated);
    handleSaveAllReviews(updated);
  };

  // ==========================================
  // POLICIES & AMENITIES ACTIONS
  // ==========================================
  const handleAddPolicy = () => {
    if (!newPolicyTitle.trim() || !newPolicyDesc.trim()) {
      showToast('Policy title and description are required', 'error');
      return;
    }
    const currentPolicies = site.policies || [];
    const updatedPolicies = [...currentPolicies, { title: newPolicyTitle.trim(), desc: newPolicyDesc.trim() }];
    const nextSite = { ...site, policies: updatedPolicies };
    setSite(nextSite);
    setNewPolicyTitle('');
    setNewPolicyDesc('');
    setIsAddingPolicy(false);
    showToast('New policy added. Click "Save Policies" to publish.');
  };

  const handleDeletePolicy = (index: number) => {
    const currentPolicies = site.policies || [];
    const updatedPolicies = currentPolicies.filter((_, i) => i !== index);
    setSite({ ...site, policies: updatedPolicies });
  };

  const handleAddAmenityTag = () => {
    if (!newAmenityInput.trim()) return;
    const current = site.amenitiesList || [];
    if (!current.includes(newAmenityInput.trim())) {
      setSite({ ...site, amenitiesList: [...current, newAmenityInput.trim()] });
    }
    setNewAmenityInput('');
  };

  const handleRemoveAmenityTag = (amenity: string) => {
    const current = site.amenitiesList || [];
    setSite({ ...site, amenitiesList: current.filter((a) => a !== amenity) });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Sub-tab navigation */}
      <div className="bg-white p-4 rounded-2xl border border-sand-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-1 sm:space-x-2 bg-sand-100 p-1 rounded-xl text-xs sm:text-sm overflow-x-auto no-scrollbar max-w-full">
          <button
            onClick={() => setActiveSubTab('hero')}
            className={`px-3.5 py-2 rounded-lg font-semibold transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
              activeSubTab === 'hero'
                ? 'bg-white text-forest-900 shadow-sm'
                : 'text-gray-600 hover:text-forest-900'
            }`}
          >
            <ImageIcon className="w-4 h-4 text-forest-600" />
            <span>Hero Carousel ({slides.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('about')}
            className={`px-3.5 py-2 rounded-lg font-semibold transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
              activeSubTab === 'about'
                ? 'bg-white text-forest-900 shadow-sm'
                : 'text-gray-600 hover:text-forest-900'
            }`}
          >
            <Info className="w-4 h-4 text-forest-600" />
            <span>About & Story</span>
          </button>
          <button
            onClick={() => setActiveSubTab('site')}
            className={`px-3.5 py-2 rounded-lg font-semibold transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
              activeSubTab === 'site'
                ? 'bg-white text-forest-900 shadow-sm'
                : 'text-gray-600 hover:text-forest-900'
            }`}
          >
            <Sliders className="w-4 h-4 text-forest-600" />
            <span>Site Info & Contacts</span>
          </button>
          <button
            onClick={() => setActiveSubTab('reviews')}
            className={`px-3.5 py-2 rounded-lg font-semibold transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
              activeSubTab === 'reviews'
                ? 'bg-white text-forest-900 shadow-sm'
                : 'text-gray-600 hover:text-forest-900'
            }`}
          >
            <Star className="w-4 h-4 text-amber-500" />
            <span>Guest Reviews ({reviewsList.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('policies')}
            className={`px-3.5 py-2 rounded-lg font-semibold transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
              activeSubTab === 'policies'
                ? 'bg-white text-forest-900 shadow-sm'
                : 'text-gray-600 hover:text-forest-900'
            }`}
          >
            <FileText className="w-4 h-4 text-forest-600" />
            <span>Policies & Amenities</span>
          </button>
        </div>

        {/* Global Save Button for Active Section */}
        {activeSubTab === 'hero' && (
          <button
            onClick={handleSaveHeroSlides}
            disabled={savingHero}
            className="flex items-center space-x-2 bg-forest-800 hover:bg-forest-900 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-sand-300" />
            <span>{savingHero ? 'Saving Slides...' : 'Save All Carousel Slides'}</span>
          </button>
        )}

        {activeSubTab === 'about' && (
          <button
            onClick={handleSaveAbout}
            disabled={savingAbout}
            className="flex items-center space-x-2 bg-forest-800 hover:bg-forest-900 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-sand-300" />
            <span>{savingAbout ? 'Saving About...' : 'Save About Section'}</span>
          </button>
        )}

        {activeSubTab === 'site' && (
          <button
            onClick={handleSaveSite}
            disabled={savingSite}
            className="flex items-center space-x-2 bg-forest-800 hover:bg-forest-900 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-sand-300" />
            <span>{savingSite ? 'Saving Settings...' : 'Save Site Settings'}</span>
          </button>
        )}

        {activeSubTab === 'reviews' && (
          <button
            onClick={() => handleSaveAllReviews()}
            disabled={savingReviews}
            className="flex items-center space-x-2 bg-forest-800 hover:bg-forest-900 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-amber-300" />
            <span>{savingReviews ? 'Saving Reviews...' : 'Save All Reviews'}</span>
          </button>
        )}

        {activeSubTab === 'policies' && (
          <button
            onClick={handleSaveSite}
            disabled={savingSite}
            className="flex items-center space-x-2 bg-forest-800 hover:bg-forest-900 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-sand-300" />
            <span>{savingSite ? 'Saving Policies...' : 'Save Policies & Amenities'}</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. HERO CAROUSEL SUB-TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'hero' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg font-bold text-forest-950">
                Hero Carousel Slides
              </h3>
              <p className="text-xs text-gray-500">
                These large scenic slides greet visitors on your homepage. Order determines rotation.
              </p>
            </div>
            <button
              onClick={() => setIsAddingSlide(!isAddingSlide)}
              className="flex items-center space-x-1.5 bg-sand-200 hover:bg-sand-300 text-forest-950 text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddingSlide ? 'Cancel' : 'Add New Slide'}</span>
            </button>
          </div>

          {/* Add Slide Form */}
          {isAddingSlide && (
            <div className="bg-sand-50 p-5 rounded-2xl border border-sand-300 space-y-4">
              <h4 className="font-bold text-xs uppercase text-forest-900">
                Create New Hero Slide
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Image URL *
                  </label>
                  <input
                    type="url"
                    value={newSlide.image}
                    onChange={(e) => setNewSlide({ ...newSlide, image: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3 py-2 bg-white border border-sand-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Top Badge Text
                  </label>
                  <input
                    type="text"
                    value={newSlide.badge}
                    onChange={(e) => setNewSlide({ ...newSlide, badge: e.target.value })}
                    placeholder="e.g. Serene Mountain Getaway"
                    className="w-full px-3 py-2 bg-white border border-sand-300 rounded-xl text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Main Headline *
                  </label>
                  <input
                    type="text"
                    value={newSlide.title}
                    onChange={(e) => setNewSlide({ ...newSlide, title: e.target.value })}
                    placeholder="e.g. Escape to Tranquility in the Himalayan Hills"
                    className="w-full px-3 py-2 bg-white border border-sand-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Sub-headline / Description
                  </label>
                  <input
                    type="text"
                    value={newSlide.subtitle}
                    onChange={(e) => setNewSlide({ ...newSlide, subtitle: e.target.value })}
                    placeholder="Short engaging description for guests..."
                    className="w-full px-3 py-2 bg-white border border-sand-300 rounded-xl text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setIsAddingSlide(false)}
                  className="px-3 py-1.5 rounded-lg border border-sand-300 text-xs font-semibold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSlide}
                  className="px-4 py-1.5 rounded-lg bg-forest-800 text-white text-xs font-semibold shadow-sm"
                >
                  Add Slide to List
                </button>
              </div>
            </div>
          )}

          {/* Slides List */}
          <div className="space-y-4">
            {slides.map((slide, idx) => (
              <div
                key={slide.id}
                className="bg-white p-4 rounded-2xl border border-sand-200 shadow-sm flex flex-col md:flex-row items-start md:items-center gap-4"
              >
                {/* Thumbnail */}
                <div className="w-full md:w-44 h-28 rounded-xl bg-sand-200 overflow-hidden relative shrink-0">
                  <img
                    src={slide.image}
                    alt={slide.title}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-1.5 left-1.5 bg-black/60 text-white font-mono text-[10px] px-1.5 py-0.5 rounded">
                    Slide #{idx + 1}
                  </span>
                </div>

                {/* Form fields */}
                <div className="flex-1 space-y-2 w-full">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 block">
                        Badge
                      </label>
                      <input
                        type="text"
                        value={slide.badge || ''}
                        onChange={(e) => handleUpdateSlideField(idx, 'badge', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-sand-50 border border-sand-200 rounded-lg text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] uppercase font-bold text-gray-400 block">
                        Headline Title
                      </label>
                      <input
                        type="text"
                        value={slide.title}
                        onChange={(e) => handleUpdateSlideField(idx, 'title', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-sand-50 border border-sand-200 rounded-lg text-xs font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-400 block">
                      Subtitle
                    </label>
                    <input
                      type="text"
                      value={slide.subtitle}
                      onChange={(e) => handleUpdateSlideField(idx, 'subtitle', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-sand-50 border border-sand-200 rounded-lg text-xs text-gray-600"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-400 block">
                      Image URL
                    </label>
                    <input
                      type="url"
                      value={slide.image}
                      onChange={(e) => handleUpdateSlideField(idx, 'image', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-sand-50 border border-sand-200 rounded-lg text-xs font-mono text-gray-500"
                    />
                  </div>
                </div>

                {/* Reorder and Delete Controls */}
                <div className="flex md:flex-col items-center justify-between w-full md:w-auto gap-1 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-sand-200">
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveSlide(idx, 'up')}
                      className="p-1.5 rounded-lg bg-sand-100 hover:bg-sand-200 text-gray-700 disabled:opacity-30"
                      title="Move slide earlier"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === slides.length - 1}
                      onClick={() => handleMoveSlide(idx, 'down')}
                      className="p-1.5 rounded-lg bg-sand-100 hover:bg-sand-200 text-gray-700 disabled:opacity-30"
                      title="Move slide later"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteSlide(slide.id)}
                    className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600"
                    title="Delete slide"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ABOUT & STORY SUB-TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'about' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-sand-200 shadow-sm space-y-4">
            <h3 className="font-serif text-lg font-bold text-forest-950">
              About Section & Story
            </h3>

            <div>
              <label className="block text-xs font-semibold text-forest-900 mb-1">
                Headline Title
              </label>
              <input
                type="text"
                value={about.headline}
                onChange={(e) => setAbout({ ...about, headline: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-sand-50 border border-sand-300 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-forest-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-forest-900 mb-1">
                Homestay Story Narrative
              </label>
              <textarea
                rows={5}
                value={about.story}
                onChange={(e) => setAbout({ ...about, story: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-sand-50 border border-sand-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-forest-600 resize-none"
              />
            </div>
          </div>

          {/* Key Statistics */}
          <div className="bg-white p-6 rounded-2xl border border-sand-200 shadow-sm space-y-4">
            <h3 className="font-serif text-base font-bold text-forest-950">
              Key Metrics & Highlights (4 Badges)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {about.stats.map((stat, idx) => (
                <div key={idx} className="p-3 bg-sand-50 rounded-xl border border-sand-200 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-gray-400">
                    Metric #{idx + 1}
                  </span>
                  <div>
                    <label className="text-[11px] font-semibold text-forest-900 block mb-0.5">Value</label>
                    <input
                      type="text"
                      value={stat.value}
                      onChange={(e) => handleUpdateStat(idx, 'value', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-sand-300 rounded-lg text-xs font-bold text-forest-950"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-forest-900 block mb-0.5">Label</label>
                    <input
                      type="text"
                      value={stat.label}
                      onChange={(e) => handleUpdateStat(idx, 'label', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-sand-300 rounded-lg text-xs text-gray-700"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Highlights */}
          <div className="bg-white p-6 rounded-2xl border border-sand-200 shadow-sm space-y-4">
            <h3 className="font-serif text-base font-bold text-forest-950">
              Feature Highlights Cards
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {about.highlights.map((h, idx) => (
                <div key={idx} className="p-3.5 bg-sand-50 rounded-xl border border-sand-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-forest-700">
                      Highlight #{idx + 1} ({h.icon})
                    </span>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-forest-900 block mb-0.5">Title</label>
                    <input
                      type="text"
                      value={h.title}
                      onChange={(e) => handleUpdateHighlight(idx, 'title', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-sand-300 rounded-lg text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-forest-900 block mb-0.5">Description</label>
                    <textarea
                      rows={2}
                      value={h.desc}
                      onChange={(e) => handleUpdateHighlight(idx, 'desc', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-sand-300 rounded-lg text-xs text-gray-600 resize-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SITE INFO & CONTACT SUB-TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'site' && (
        <div className="bg-white p-6 rounded-2xl border border-sand-200 shadow-sm space-y-5">
          <div>
            <h3 className="font-serif text-lg font-bold text-forest-950">
              Site Brand & Contact Information
            </h3>
            <p className="text-xs text-gray-500">
              These details appear in the header, footer, floating CTA bar, and WhatsApp action links.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-forest-900 mb-1">
                Homestay Property Name
              </label>
              <input
                type="text"
                value={site.name}
                onChange={(e) => setSite({ ...site, name: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-sand-50 border border-sand-300 rounded-xl text-xs sm:text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-forest-900 mb-1">
                Property Tagline
              </label>
              <input
                type="text"
                value={site.tagline}
                onChange={(e) => setSite({ ...site, tagline: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-sand-50 border border-sand-300 rounded-xl text-xs sm:text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-forest-900 mb-1">
                Direct Phone Number
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={site.phone}
                  onChange={(e) => setSite({ ...site, phone: e.target.value })}
                  placeholder="+91 81012 98882"
                  className="w-full pl-9 pr-3 py-2.5 bg-sand-50 border border-sand-300 rounded-xl text-xs sm:text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-forest-900 mb-1">
                WhatsApp Number (Digits only, with country code)
              </label>
              <div className="relative">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={site.whatsapp}
                  onChange={(e) => setSite({ ...site, whatsapp: e.target.value })}
                  placeholder="918101298882"
                  className="w-full pl-9 pr-3 py-2.5 bg-sand-50 border border-sand-300 rounded-xl text-xs sm:text-sm font-mono text-emerald-800 font-semibold"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-forest-900 mb-1">
                Contact Email
              </label>
              <input
                type="email"
                value={site.email}
                onChange={(e) => setSite({ ...site, email: e.target.value })}
                placeholder="info.saverahomestay@gmail.com"
                className="w-full px-3.5 py-2.5 bg-sand-50 border border-sand-300 rounded-xl text-xs sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-forest-900 mb-1">
              Physical Property Address
            </label>
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={site.address}
                onChange={(e) => setSite({ ...site, address: e.target.value })}
                placeholder="35a, Hill Cart Rd, West Point, Cart Road, Darjeeling, West Bengal 734101"
                className="w-full pl-9 pr-3 py-2.5 bg-sand-50 border border-sand-300 rounded-xl text-xs sm:text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-forest-900 mb-1">
                Google Maps Location URL
              </label>
              <input
                type="url"
                value={site.map_url || ''}
                onChange={(e) => setSite({ ...site, map_url: e.target.value })}
                placeholder="https://maps.app.goo.gl/KMJe676np8aDYExD6"
                className="w-full px-3.5 py-2.5 bg-sand-50 border border-sand-300 rounded-xl text-xs sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-forest-900 mb-1">
                Google Business Profile Link
              </label>
              <input
                type="url"
                value={site.google_business_url || ''}
                onChange={(e) => setSite({ ...site, google_business_url: e.target.value })}
                placeholder="https://share.google/ufeIhNLjkk7qoPffW"
                className="w-full px-3.5 py-2.5 bg-sand-50 border border-sand-300 rounded-xl text-xs sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-forest-900 mb-1">
              Directions / Getting Here Guide
            </label>
            <div className="relative">
              <Navigation className="w-3.5 h-3.5 text-forest-700 absolute left-3 top-3" />
              <textarea
                rows={2}
                value={site.directions || ''}
                onChange={(e) => setSite({ ...site, directions: e.target.value })}
                placeholder="Instructions on reaching the property from nearest landmarks..."
                className="w-full pl-9 pr-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs sm:text-sm resize-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-forest-900 mb-1">
                Check-in Time
              </label>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={site.check_in_time}
                  onChange={(e) => setSite({ ...site, check_in_time: e.target.value })}
                  placeholder="2:00 PM"
                  className="w-full pl-9 pr-3 py-2.5 bg-sand-50 border border-sand-300 rounded-xl text-xs sm:text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-forest-900 mb-1">
                Check-out Time
              </label>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={site.check_out_time}
                  onChange={(e) => setSite({ ...site, check_out_time: e.target.value })}
                  placeholder="11:00 AM"
                  className="w-full pl-9 pr-3 py-2.5 bg-sand-50 border border-sand-300 rounded-xl text-xs sm:text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. CUSTOMER REVIEWS SUB-TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'reviews' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-serif text-lg font-bold text-forest-950">
                Customer Testimonials & Google Reviews
              </h3>
              <p className="text-xs text-gray-500">
                Manage guest reviews displayed on the website. Toggle &quot;Featured&quot; to show them on the public landing page.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingReview(null);
                setReviewForm({
                  author_name: '',
                  author_location: 'Verified Guest',
                  rating: 5,
                  review_text: '',
                  review_date: 'Recently',
                  is_featured: true,
                });
                setIsAddingReview(!isAddingReview);
              }}
              className="flex items-center space-x-1.5 bg-amber-500 hover:bg-amber-600 text-forest-950 text-xs font-bold px-3.5 py-2 rounded-xl transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddingReview ? 'Cancel' : 'Add Guest Review'}</span>
            </button>
          </div>

          {/* Add / Edit Review Modal / Form */}
          {isAddingReview && (
            <div className="bg-sand-50 p-5 rounded-2xl border border-sand-300 space-y-4 animate-slide-up">
              <h4 className="font-bold text-xs uppercase text-forest-900 flex items-center space-x-1.5">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>{editingReview ? 'Edit Guest Review' : 'Create New Guest Review'}</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Guest / Author Name *
                  </label>
                  <input
                    type="text"
                    value={reviewForm.author_name || ''}
                    onChange={(e) => setReviewForm({ ...reviewForm, author_name: e.target.value })}
                    placeholder="e.g. Dr. Rohan Malhotra"
                    className="w-full px-3 py-2 bg-white border border-sand-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Location / Guest Tag
                  </label>
                  <input
                    type="text"
                    value={reviewForm.author_location || ''}
                    onChange={(e) => setReviewForm({ ...reviewForm, author_location: e.target.value })}
                    placeholder="e.g. Delhi NCR, Couple Stay"
                    className="w-full px-3 py-2 bg-white border border-sand-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Star Rating (1 - 5)
                  </label>
                  <select
                    value={reviewForm.rating || 5}
                    onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white border border-sand-300 rounded-xl text-xs font-semibold text-amber-800"
                  >
                    <option value={5}>★★★★★ (5.0 Stars)</option>
                    <option value={4.9}>★★★★★ (4.9 Stars)</option>
                    <option value={4.8}>★★★★★ (4.8 Stars)</option>
                    <option value={4.5}>★★★★☆ (4.5 Stars)</option>
                    <option value={4}>★★★★☆ (4.0 Stars)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-900 mb-1">
                  Review Text / Comment *
                </label>
                <textarea
                  rows={3}
                  value={reviewForm.review_text || ''}
                  onChange={(e) => setReviewForm({ ...reviewForm, review_text: e.target.value })}
                  placeholder="The guest experience testimonial quote..."
                  className="w-full px-3 py-2 bg-white border border-sand-300 rounded-xl text-xs resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Review Date String
                  </label>
                  <input
                    type="text"
                    value={reviewForm.review_date || ''}
                    onChange={(e) => setReviewForm({ ...reviewForm, review_date: e.target.value })}
                    placeholder="e.g. 2 weeks ago, October 2026"
                    className="w-full px-3 py-2 bg-white border border-sand-300 rounded-xl text-xs"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-4">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reviewForm.is_featured ?? true}
                      onChange={(e) => setReviewForm({ ...reviewForm, is_featured: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                    <span className="ml-2 text-xs font-semibold text-forest-900">
                      Feature on Homepage Landing Page
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingReview(false);
                    setEditingReview(null);
                  }}
                  className="px-3.5 py-1.5 rounded-lg border border-sand-300 text-xs font-semibold text-gray-600 hover:bg-sand-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddOrEditReview}
                  className="px-4 py-1.5 rounded-lg bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold shadow-sm"
                >
                  {editingReview ? 'Update Review' : 'Save & Publish Review'}
                </button>
              </div>
            </div>
          )}

          {/* Reviews List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviewsList.map((rev) => (
              <div
                key={rev.id}
                className={`bg-white p-5 rounded-2xl border shadow-sm flex flex-col justify-between transition-all ${
                  rev.is_featured ? 'border-sand-300 ring-1 ring-amber-400/30' : 'border-sand-200 opacity-85'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-1 text-amber-500">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < Math.floor(rev.rating) ? 'fill-current' : 'text-gray-300'
                          }`}
                        />
                      ))}
                      <span className="text-xs font-bold text-forest-950 ml-1.5">
                        {rev.rating.toFixed(1)}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        rev.is_featured
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {rev.is_featured ? 'Featured on Site' : 'Standard'}
                    </span>
                  </div>

                  <p className="text-xs text-gray-700 leading-relaxed italic mb-4">
                    &ldquo;{rev.review_text}&rdquo;
                  </p>
                </div>

                <div className="pt-3 border-t border-sand-100 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-forest-950">{rev.author_name}</h4>
                    <p className="text-[10px] text-gray-400">
                      {rev.author_location || 'Verified Guest'} • {rev.review_date}
                    </p>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleFeaturedReview(rev.id)}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors ${
                        rev.is_featured
                          ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                          : 'bg-sand-50 text-gray-600 border-sand-300 hover:bg-sand-100'
                      }`}
                      title="Toggle visibility on homepage"
                    >
                      {rev.is_featured ? 'Unfeature' : 'Feature'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingReview(rev);
                        setReviewForm(rev);
                        setIsAddingReview(true);
                      }}
                      className="p-1.5 rounded-lg bg-sand-100 hover:bg-sand-200 text-forest-900"
                      title="Edit review"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteReview(rev.id)}
                      className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600"
                      title="Delete review"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. POLICIES & AMENITIES SUB-TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'policies' && (
        <div className="space-y-6">
          {/* House Policies Section */}
          <div className="bg-white p-6 rounded-2xl border border-sand-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg font-bold text-forest-950">
                  Sanctuary House Policies & Ethics
                </h3>
                <p className="text-xs text-gray-500">
                  Displayed on the website, booking vouchers, and in-room digital concierge.
                </p>
              </div>
              <button
                onClick={() => setIsAddingPolicy(!isAddingPolicy)}
                className="flex items-center space-x-1.5 bg-sand-200 hover:bg-sand-300 text-forest-950 text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAddingPolicy ? 'Cancel' : 'Add Policy'}</span>
              </button>
            </div>

            {/* Add Policy Form */}
            {isAddingPolicy && (
              <div className="bg-sand-50 p-4 rounded-xl border border-sand-300 space-y-3">
                <h4 className="font-bold text-xs uppercase text-forest-900">New Policy Clause</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-forest-900 mb-1">
                      Policy Title *
                    </label>
                    <input
                      type="text"
                      value={newPolicyTitle}
                      onChange={(e) => setNewPolicyTitle(e.target.value)}
                      placeholder="e.g. Quiet Hours, Cancellation & Refunds"
                      className="w-full px-3 py-2 bg-white border border-sand-300 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-forest-900 mb-1">
                      Policy Clause Description *
                    </label>
                    <input
                      type="text"
                      value={newPolicyDesc}
                      onChange={(e) => setNewPolicyDesc(e.target.value)}
                      placeholder="e.g. Full refund if cancelled 7+ days in advance..."
                      className="w-full px-3 py-2 bg-white border border-sand-300 rounded-xl text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingPolicy(false)}
                    className="px-3 py-1.5 rounded-lg border border-sand-300 text-xs font-semibold text-gray-600 hover:bg-sand-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddPolicy}
                    className="px-4 py-1.5 rounded-lg bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold shadow-sm"
                  >
                    Add Policy Clause
                  </button>
                </div>
              </div>
            )}

            {/* Current Policies List */}
            <div className="space-y-3">
              {(site.policies || []).map((p, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-sand-50/70 rounded-xl border border-sand-200 flex items-start justify-between gap-4"
                >
                  <div className="flex items-start space-x-3">
                    <ShieldCheck className="w-4 h-4 text-forest-700 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="font-bold text-xs text-forest-950">{p.title}</h4>
                      <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{p.desc}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeletePolicy(idx)}
                    className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 shrink-0"
                    title="Delete policy"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Master Property Amenities Section */}
          <div className="bg-white p-6 rounded-2xl border border-sand-200 shadow-sm space-y-4">
            <div>
              <h3 className="font-serif text-lg font-bold text-forest-950">
                Property Amenities & Badges
              </h3>
              <p className="text-xs text-gray-500">
                These amenities appear across the homestay pages and can be attached to rooms.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(site.amenitiesList || []).map((amenity, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center space-x-1.5 bg-forest-50 text-forest-900 border border-forest-200 px-3 py-1.5 rounded-xl text-xs font-semibold"
                >
                  <Check className="w-3 h-3 text-forest-700" />
                  <span>{amenity}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAmenityTag(amenity)}
                    className="hover:text-red-600 ml-1 text-gray-400"
                    title="Remove amenity tag"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2 max-w-md">
              <input
                type="text"
                value={newAmenityInput}
                onChange={(e) => setNewAmenityInput(e.target.value)}
                placeholder="Add amenity (e.g. Electric Vehicle Charger)..."
                className="flex-1 px-3 py-2 bg-sand-50 border border-sand-300 rounded-xl text-xs"
              />
              <button
                type="button"
                onClick={handleAddAmenityTag}
                className="px-4 py-2 bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold rounded-xl"
              >
                Add Tag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
