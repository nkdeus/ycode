'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const apiUrl = 'https://api.conciergerieeasystay.fr';
// const apiUrl = 'http://localhost:3000';

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function findProductBySlug(products: Product[], slug: string | null): Product | null {
  if (!slug) return null;
  return products.find(p => slugify(p.name) === slug || p.priceId === slug) || null;
}

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

function SuccessMessage({ type }: { type: 'EXISTING_USER' | 'NEW_USER' }) {
  const message = type === 'EXISTING_USER'
    ? 'Votre abonnement a été mis à jour avec succès. Vous pouvez maintenant accéder à votre application pour gérer vos propriétés.'
    : 'Merci pour votre abonnement ! Vous pouvez maintenant accéder à votre application pour gérer vos propriétés.\n Un email vous a été envoyé avec les détails pour vous connecter à votre compte.';
  return (
    <div className='bg-green-50 border border-green-200 text-green-700 rounded-lg p-6 text-center'>
      <h2 className='text-2xl font-bold mb-4'>Abonnement mis à jour avec succès !</h2>
      <p className='text-lg'>{message}</p>
      <button
        onClick={() => window.location.href = '/'}
        className='mt-6 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors'
      >
        Retour à l&apos;accueil
      </button>
    </div>
  );
}

function EmailForm({ product, onBack }: { product: Product; onBack: () => void }) {
  const [email, setEmail] = useState<string>('');
  const [propertyNumber, setPropertyNumber] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [tokenMendatory, setTokenMandatory] = useState(false);
  const [token, setToken] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [propertyNumberAlreadyUsed, setPropertyNumberAlreadyUsed] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (email && propertyNumber) {
      console.log('Submitting subscription for product:', product);
      console.log('Email:', email);
      console.log('Property Number:', propertyNumber);
      console.log('Token:', token);
      const res = await fetch(`${apiUrl}/subscriptions/create-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          propertyNumber,
          priceId: product.priceId,
          token: tokenMendatory ? token : undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSubmitted(true);
          if (data.object && data.object === 'subscription') {
            setSuccessMessage('Votre abonnement a été mis à jour avec succès. Vous pouvez maintenant accéder à votre application pour gérer vos propriétés.');
          }
          if (data.session && data.session.url) {
            window.location.href = data.session.url;
          }
        } else {
          if (data.tokenNeeded) {
            setTokenMandatory(true);
          }
          if (data.propertyNumber && data.propertyNumber > (propertyNumber ?? 0)) {
            setPropertyNumberAlreadyUsed(data.propertyNumber);
          }
        }
        console.log('Subscription session created:', data);
      } else {
        console.error('Failed to create subscription session');
        const errorData = await res.json();
        setErrorMessage(errorData.message || 'Une erreur est survenue. Veuillez réessayer.');
      }
    }
  }

  if (successMessage) {
    return (
      <SuccessMessage type={'EXISTING_USER'} />
    );
  }

  return (
    <div className='w-full max-w-md mx-auto'>
      {/* Header */}
      <div className='mb-8 text-center'>
        <h2 className='text-3xl font-bold text-neutral-900 mb-2'>
          Votre abonnement EasyStay
        </h2>
        <p className='text-neutral-600'>
          Produit: <span className='font-semibold'>{product.name}</span>
        </p>
      </div>

      {/* Form Card */}
      <div className='bg-white rounded-lg shadow-md border border-neutral-200 p-8'>
        <form onSubmit={handleSubmit} className='space-y-6'>
          {/* Email Field */}
          <div className='space-y-2'>
            <Label htmlFor='email' className='text-sm font-medium text-neutral-700'>
              Adresse e-mail
            </Label>
            <Input
              id='email'
              type='email'
              placeholder='exemple@email.com'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className='w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition'
            />
            <p className='text-xs text-neutral-500 mt-1'>
              Si vous avez déjà un compte EasyStay, utilisez le même email.
            </p>
          </div>

          {/* Property Number Field */}
          <div className='space-y-2'>
            <Label htmlFor='propertyNumber' className='text-sm font-medium text-neutral-700'>
              Nombre de propriétés à gérer
            </Label>
            <Input
              id='propertyNumber'
              type='number'
              placeholder='Ex: 3'
              value={propertyNumber ?? ''}
              onChange={(e) => setPropertyNumber(e.target.value ? parseInt(e.target.value) : null)}
              required
              className='w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition'
            />
            {propertyNumberAlreadyUsed && propertyNumberAlreadyUsed > (propertyNumber ?? 0) && (
              <p className='text-xs text-red-500 mt-1'>
                Vous avez déjà {propertyNumberAlreadyUsed} propriétés sur votre application. Le nombre de propriétés doit être au moins {propertyNumberAlreadyUsed}.
              </p>
            )}
          </div>

          {tokenMendatory && (
            <div className='space-y-2'>
              <Label htmlFor='token' className='text-sm font-medium text-neutral-700'>Pour la sécurité de votre compte, un token de validation a été envoyé à votre adresse email.</Label>
              <Input
                id='token'
                type='text'
                placeholder='Entrez votre token'
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                className='w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition'
              />
            </div>
          )}

          {/* Price Summary */}
          <div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
            <p className='text-sm text-neutral-600 mb-1'>Prix de l&apos;abonnement</p>
            <div className='flex items-baseline gap-2'>
              <span className='text-2xl font-bold text-neutral-900'>
                {(product.unit_amount / 100).toFixed(2)}€
              </span>
              {(product.billing_scheme === 'per_unit' || product.recurring) && (
                <span className='text-sm text-neutral-600'>
                  / {formatBillingText(product.billing_scheme, product.recurring?.interval, product.recurring?.interval_count)}
                </span>
              )}
            </div>
          </div>
          {errorMessage && (
            <div className='bg-red-50 border border-red-200 text-red-700 rounded-lg p-4'>
              {errorMessage}
            </div>
          )}
          {/* Submit Button */}
          <Button
            type='submit'
            disabled={!email || !propertyNumber || submitted}
            className='w-full bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200'
          >
            {submitted ? '✓ Abonnement en cours...' : 'S\'abonner maintenant'}
          </Button>
        </form>

        {/* Back Link */}
        <button
          type='button'
          onClick={onBack}
          className='w-full mt-4 text-sm text-neutral-600 hover:text-neutral-900 font-medium transition'
        >
          ← Retour aux produits
        </button>
      </div>
    </div>
  );
}

function SelectProduct({ products, onSelect }: { products: Product[]; onSelect: (product: Product) => void }) {
  return (
    <div>
      <div className='text-center'>
        <h1 className='text-3xl font-bold text-neutral-900 mb-6'>
          Solution EasyStay
        </h1>
      </div>
      
      <div className='flex flex-wrap justify-center gap-6 w-full'>
        {products.map((product) => (
          <div
            key={product.id}
            className='group flex flex-col h-full w-full max-w-sm bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden border border-neutral-200'
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
                onClick={() => onSelect(product)}
                className='w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors'
              >
                Subscribe
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Subscribe() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sessionCreated, setSessionCreated] = useState<'EXISTING_USER' | 'NEW_USER' | null>(null);

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
    async function handlePostSubscription(session_id: string) {
      try {
        const res = await fetch(`${apiUrl}/subscriptions/success?session_id=${session_id}`);
        const data = await res.json();
        if (data.subscription.object === 'subscription' && data.subscription.status === 'active') {
          setSessionCreated(data.type);
        } else {
          setSessionCreated(null);
        }
      } catch (error) {
        console.error('Error handling post-subscription:', error);
        setSessionCreated(null);
      }
    }
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (sessionId) {
      handlePostSubscription(sessionId);
    } else {
      fetchProducts();
    }
  }, []);

  // Sync URL → state once products are loaded (deep-link entry from /tarifs cards)
  useEffect(() => {
    if (!products.length) return;
    const slug = new URLSearchParams(window.location.search).get('product');
    const match = findProductBySlug(products, slug);
    if (match) setSelectedProduct(match);
  }, [products]);

  // Browser back/forward keeps state aligned with URL
  useEffect(() => {
    function onPop() {
      const slug = new URLSearchParams(window.location.search).get('product');
      setSelectedProduct(findProductBySlug(products, slug));
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [products]);

  function subscribeToProduct(product: Product) {
    setSelectedProduct(product);
    const params = new URLSearchParams(window.location.search);
    params.set('product', slugify(product.name));
    const qs = params.toString();
    window.history.pushState({}, '', `${window.location.pathname}${qs ? '?' + qs : ''}`);
  }

  function backToProducts() {
    setSelectedProduct(null);
    const params = new URLSearchParams(window.location.search);
    params.delete('product');
    const qs = params.toString();
    window.history.pushState({}, '', `${window.location.pathname}${qs ? '?' + qs : ''}`);
  }

  if (sessionCreated) {
    return (
      <SuccessMessage type={sessionCreated} />
    );

  }

  return (
    <div className='flex flex-col items-center gap-12 py-24 px-4 max-w-7xl mx-auto w-full'>
      
      {selectedProduct ? (
        <EmailForm product={selectedProduct} onBack={backToProducts} />
      ) : (
        <SelectProduct products={products} onSelect={subscribeToProduct} />
      )}
      {/* Empty State */}
      {products.length === 0 && (
        <div className='text-center py-12'>
          <p className='text-neutral-500 text-lg'>Aucun produit disponible pour le moment.</p>
        </div>
      )}
    </div>
  );
}

export default function SubscribeMount() {
  const [target, setTarget] = useState<Element | null>(null);

  useEffect(() => {
    setTarget(document.getElementById('custom-content'));
  }, []);

  if (!target) return null;
  return createPortal(<Subscribe />, target);
}
