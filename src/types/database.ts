export interface StyleSurvey {
  id: string;
  session_id: string;
  style_preferences: Record<string, any>;
  occasion: string;
  budget_range: string;
  created_at: string;
}

export interface CelebrityLook {
  id: string;
  celebrity_name: string;
  image_url: string;
  style_tags: string[];
  description: string;
  occasion_tags: string[];
  created_at: string;
}

export interface DatabaseProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  style_tags: string[];
  category: string;
  in_stock: boolean;
  ar_model_url: string | null;
  created_at: string;
}

export interface Wishlist {
  id: string;
  session_id: string;
  product_id: string;
  created_at: string;
}

export interface Order {
  id: string;
  session_id: string;
  product_id: string;
  status: string;
  created_at: string;
}
