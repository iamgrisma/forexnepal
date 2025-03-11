
export interface Currency {
  name: string;
  iso3: string;
  unit: number;
}

export interface Rate {
  currency: Currency;
  buy: number;
  sell: number;
}

export interface RatesData {
  date: string;
  published_on: string;
  modified_on: string;
  rates: Rate[];
}

export interface ForexResponse {
  status: {
    code: number;
    message: string;
  };
  data: {
    payload: RatesData[];
    pagination: {
      page: number;
      per_page: number;
      total_page: number;
      total_count: number;
    };
  };
}

export interface FlagEmojiMap {
  [key: string]: string;
}
