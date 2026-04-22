'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';

type Product = {
  id: number;
  description: string;
  name: string;
  priceId: string;
  unit_amount: number;
  recurring: {
    interval: string;
    interval_count: number;
  } | null;
  type: 'one_time' | 'recurring';
  images: string[];
  billing_scheme?: string;
};

function transformStripeData(data: {
  products: Array<{ id: string; name: string; description: string; images: string[]; default_price: string }>;
  prices: Array<{
    id: string;
    unit_amount: number;
    recurring: { interval: string; interval_count: number } | null;
    type: string;
    billing_scheme?: string;
  }>;
}): Product[] {
  return data.products.map((product) => {
    const price = data.prices.find((p) => p.id === product.default_price);
    return {
      id: parseInt(product.id.split('_')[1], 10) || 0,
      name: product.name,
      description: product.description,
      priceId: price?.id || '',
      unit_amount: price?.unit_amount || 0,
      recurring: price?.recurring || null,
      type: (price?.type === 'recurring' ? 'recurring' : 'one_time') as 'one_time' | 'recurring',
      images: product.images || [],
      billing_scheme: price?.billing_scheme,
    };
  });
}

const apiUrl = 'https://api.conciergerieeasystay.fr';

/**
 * Formate le texte de facturation pour l'affichage
 * Convertit "unit" → "logement" et traduit les intervalles (month → mois, year → an/ans)
 */
function formatBillingText(
  billingScheme: string | undefined,
  interval: string | undefined,
  intervalCount: number = 1
): string {
  const parts: string[] = [];

  // Traduire le schéma de facturation
  if (billingScheme === 'per_unit') {
    parts.push('logement');
  }

  // Traduire l'intervalle
  if (interval) {
    const intervalLabels: { [key: string]: string } = {
      'month': intervalCount > 1 ? 'mois' : 'mois',
      'year': intervalCount > 1 ? 'ans' : 'an',
      'week': intervalCount > 1 ? 'semaines' : 'semaine',
      'day': intervalCount > 1 ? 'jours' : 'jour',
    };

    const label = intervalLabels[interval] || interval;
    const count = intervalCount > 1 ? `${intervalCount} ` : '';
    parts.push(`${count}${label}`);
  }

  return parts.join(' / ');
}

function HelloMika() {
  const [count, setCount] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch(`${apiUrl}/subscriptions/products`);
        const data = await res.json();
        setProducts(transformStripeData(data));
      } catch (error) {
        console.error('Error fetching products:', error);
      }    
    }
    fetchProducts();
  }, []);

  function subscribeToProduct(product: Product) {
    console.log('Subscribing to product:', product);
  }

  return (
    <div className='flex flex-col items-center gap-12 py-24 px-4 max-w-7xl mx-auto w-full'>
      <div className='text-center'>
        <h1 className='text-6xl font-bold mb-4'>Hello Mika</h1>
        <p className='text-lg text-neutral-600'>
          Voici les produits disponibles :
        </p>
      </div>
      
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full'>
        {products.map((product) => (
          <div
            key={product.id}
            className='group flex flex-col h-full bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden border border-neutral-200'
          >
            {/* Product Image */}
            {product.images && product.images.length > 0 ? (
              <div className='relative w-full h-48 bg-neutral-100 overflow-hidden'>
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-300'
                />
              </div>
            ) : (
              <div className='w-full h-48 bg-gradient-to-br from-neutral-200 to-neutral-300 flex items-center justify-center'>
                <span className='text-neutral-500 text-sm'>No image</span>
              </div>
            )}

            {/* Product Content */}
            <div className='flex flex-col flex-1 p-5'>
              <h3 className='text-xl font-semibold text-neutral-900 mb-2'>
                {product.name}
              </h3>
              
              <p className='text-sm text-neutral-600 mb-4 flex-1'>
                {product.description}
              </p>

              {/* Pricing Section */}
              <div className='mb-4 pt-4 border-t border-neutral-200'>
                <div className='flex items-baseline gap-1'>
                  <span className='text-3xl font-bold text-neutral-900'>
                    {(product.unit_amount / 100).toFixed(2)}€
                  </span>
                  {(product.billing_scheme === 'per_unit' || product.recurring) && (
                    <span className='text-sm text-neutral-500'>
                      / {formatBillingText(product.billing_scheme, product.recurring?.interval, product.recurring?.interval_count)}
                    </span>
                  )}
                </div>
              </div>

              {/* Subscribe Button */}
              <Button
                onClick={() => subscribeToProduct(product)}
                className='w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors'
              >
                Subscribe
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {products.length === 0 && (
        <div className='text-center py-12'>
          <p className='text-neutral-500 text-lg'>Aucun produit disponible pour le moment.</p>
        </div>
      )}
    </div>
  );
}

export default function HelloMikaMount() {
  const [target, setTarget] = useState<Element | null>(null);

  useEffect(() => {
    setTarget(document.getElementById('custom-content'));
  }, []);

  if (!target) return null;
  return createPortal(<HelloMika />, target);
}
