import { supabase } from '@/integrations/supabase/client';
import { StyleSurvey, CelebrityLook, DatabaseProduct, Wishlist, Order } from '@/types/database';

export const supabaseService = {
  async saveSurvey(sessionId: string, occasion: string, stylePreferences: string[], budgetRange: string) {
    const { data, error } = await supabase
      .from('style_surveys')
      .insert({
        session_id: sessionId,
        occasion,
        style_preferences: { styles: stylePreferences },
        budget_range: budgetRange,
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    return data as StyleSurvey;
  },

  async getCelebrityLooksByTags(styleTags: string[], occasionTags: string[]) {
    const { data, error } = await supabase
      .from('celebrity_looks')
      .select('*')
      .overlaps('style_tags', styleTags)
      .overlaps('occasion_tags', occasionTags);

    if (error) throw error;
    return data as CelebrityLook[];
  },

  async getAllCelebrityLooks() {
    const { data, error } = await supabase
      .from('celebrity_looks')
      .select('*');

    if (error) throw error;
    return data as CelebrityLook[];
  },

  async getProducts(filters?: { category?: string; minPrice?: number; maxPrice?: number; styleTags?: string[] }) {
    let query = supabase
      .from('products')
      .select('*')
      .eq('in_stock', true);

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    if (filters?.minPrice !== undefined) {
      query = query.gte('price', filters.minPrice);
    }

    if (filters?.maxPrice !== undefined) {
      query = query.lte('price', filters.maxPrice);
    }

    if (filters?.styleTags && filters.styleTags.length > 0) {
      query = query.overlaps('style_tags', filters.styleTags);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data as DatabaseProduct[];
  },

  async addToWishlist(sessionId: string, productId: string) {
    const { data, error } = await supabase
      .from('wishlists')
      .insert({
        session_id: sessionId,
        product_id: productId,
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    return data as Wishlist;
  },

  async getWishlist(sessionId: string) {
    const { data, error } = await supabase
      .from('wishlists')
      .select('*, products(*)')
      .eq('session_id', sessionId);

    if (error) throw error;
    return data;
  },

  async removeFromWishlist(wishlistId: string) {
    const { error } = await supabase
      .from('wishlists')
      .delete()
      .eq('id', wishlistId);

    if (error) throw error;
  },

  async createOrder(sessionId: string, productId: string) {
    const { data, error } = await supabase
      .from('orders')
      .insert({
        session_id: sessionId,
        product_id: productId,
        status: 'pending',
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    return data as Order;
  },

  async callMatchCelebrity(occasion: string, stylePreferences: string[], budgetRange: string) {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/match-celebrity`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          occasion,
          stylePreferences,
          budgetRange,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to match celebrities');
    }

    return await response.json();
  },
};
