'use client';

import { useState, useEffect } from 'react';
import { X, ShoppingCart, Plus, Minus, AlertCircle, Check } from 'lucide-react';
import Image from 'next/image';
import { useCartStore } from '@/store/cartStore';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  category_id: string | null;
  stock_count: number;
  discount_price?: number | null;
  discount_end_date?: string | null;
  is_track_stock?: boolean;
  unit_name?: string;
  step_value?: number;
  min_value?: number;
}

interface ProductDetailModalProps {
  isOpen: boolean;
  product: Product | null;
  branchId: string;
  onClose: () => void;
}

export default function ProductDetailModal({
  isOpen,
  product,
  branchId,
  onClose,
}: ProductDetailModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  const cartItems = useCartStore((state) => state.items || []);
  const addItem = useCartStore((state: any) => state.addItem || state.addToCart);
  const updateQuantity = useCartStore((state: any) => state.updateQuantity || state.updateItem);

  const cartItem = product ? cartItems.find((item: any) => item.id === product.id) : null;
  const cartQuantity = cartItem ? cartItem.quantity : 0;

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen && product) {
      setQuantity(product.min_value || 1);
      setIsAdded(false);
    }
  }, [isOpen, product]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Update discount timer
  useEffect(() => {
    if (!isOpen || !product?.discount_price || !product?.discount_end_date) {
      setTimeLeft(null);
      return;
    }

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const endTime = new Date(product.discount_end_date!).getTime();
      const difference = endTime - now;

      if (difference > 0) {
        setTimeLeft({
          hours: Math.floor(difference / (1000 * 60 * 60)),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      } else {
        setTimeLeft(null);
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  const isOutOfStock = product.is_track_stock !== false && product.stock_count <= 0;
  const now = new Date().getTime();
  const isExpired = product.discount_end_date
    ? new Date(product.discount_end_date).getTime() <= now
    : false;
  const activeDiscountPrice = isExpired ? null : product.discount_price;
  const step = product.step_value || 1;
  const min = product.min_value || 1;
  const maxQty = Math.floor(product.stock_count / step);

  const handleAddToCart = () => {
    if (cartQuantity > 0) {
      updateQuantity(product.id, cartQuantity + quantity);
    } else {
      addItem({
        ...product,
        price: activeDiscountPrice || product.price,
        branchId,
        quantity,
      });
    }
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  const handleIncrement = () => {
    const nextQty = quantity + step;
    if (product.is_track_stock === false || nextQty * step <= product.stock_count) {
      setQuantity(Number((nextQty).toFixed(2)));
    }
  };

  const handleDecrement = () => {
    const prevQty = quantity - step;
    if (prevQty >= min) {
      setQuantity(Number((prevQty).toFixed(2)));
    }
  };

  const displayQuantity = Number.isInteger(quantity)
    ? quantity.toString()
    : quantity.toFixed(2).replace(/\.?0+$/, '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 px-4 py-8 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto">
        {/* Header with Close Button */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-800">รายละเอียดสินค้า</h2>
          <button
            onClick={onClose}
            title="ปิด"
            aria-label="ปิดรายละเอียดสินค้า"
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Image Section */}
          <div className="flex flex-col gap-4">
            <div className="relative w-full aspect-square bg-slate-100 rounded-xl overflow-hidden">
              {isOutOfStock && (
                <div className="absolute inset-0 bg-black/10 z-10 flex items-center justify-center backdrop-blur-[2px]">
                  <span className="bg-white/95 text-red-600 font-bold px-4 py-2 rounded-xl shadow-lg text-sm border border-red-100">
                    สินค้าหมด
                  </span>
                </div>
              )}
              {product.image_url ? (
                <Image
                  src={product.image_url}
                  alt={product.name}
                  fill
                  className={`object-cover transition-transform duration-300 ${
                    isOutOfStock ? 'grayscale opacity-80' : ''
                  }`}
                  priority
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📦</div>
                    <span className="text-sm font-medium">ไม่มีรูปภาพ</span>
                  </div>
                </div>
              )}
            </div>
            {/* Badges */}
            <div className="flex flex-col gap-2">
              {step < 1 ? (
                <div className="bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold px-3 py-2 rounded-lg text-center">
                  ⚖️ ชั่งตามน้ำหนัก
                </div>
              ) : (
                <div className="bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-lg text-center">
                  📦 แพ็ก / ชิ้น
                </div>
              )}
            </div>
          </div>

          {/* Info Section */}
          <div className="flex flex-col gap-4">
            {/* Title & Description */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-800">{product.name}</h1>
              <p className="text-slate-600 leading-relaxed text-sm">
                {product.description || 'ไม่มีคำอธิบาย'}
              </p>
            </div>

            {/* Stock Status */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-600 mb-1">จำนวนคงเหลือ</p>
              {product.is_track_stock === false ? (
                <p className="font-bold text-slate-800">มีสินค้าเพียงพอ ✓</p>
              ) : isOutOfStock ? (
                <p className="font-bold text-red-600">หมด</p>
              ) : (
                <p className="font-bold text-blue-600">{product.stock_count} {product.unit_name || 'ชิ้น'}</p>
              )}
            </div>

            {/* Price Section */}
            <div className="space-y-1">
              {activeDiscountPrice ? (
                <>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold text-red-600">
                      ฿{activeDiscountPrice.toLocaleString()}
                    </span>
                    <span className="text-lg text-slate-400 line-through">
                      ฿{product.price.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">
                    ประหยัด ฿{(product.price - activeDiscountPrice).toLocaleString()} ({Math.round(((product.price - activeDiscountPrice) / product.price) * 100)}%)
                  </div>
                  {timeLeft && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                      <p className="text-xs font-bold text-red-700 mb-1">
                        🔥 โปรโมชันหมดลงใน:
                      </p>
                      <p className="text-sm font-mono text-red-600">
                        {String(timeLeft.hours).padStart(2, '0')}:
                        {String(timeLeft.minutes).padStart(2, '0')}:
                        {String(timeLeft.seconds).padStart(2, '0')}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-3xl font-bold text-blue-600">
                  ฿{product.price.toLocaleString()}
                </div>
              )}
              {product.unit_name && (
                <p className="text-xs text-slate-600">/ {product.unit_name}</p>
              )}
            </div>

            {/* Quantity Selector */}
            {!isOutOfStock && (
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <label htmlFor="quantity-input" className="text-sm font-bold text-slate-700">จำนวน:</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDecrement}
                      disabled={quantity <= min}
                      title="ลดจำนวน"
                      aria-label="ลดจำนวนสินค้า"
                      className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      id="quantity-input"
                      type="number"
                      value={displayQuantity}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val >= min) {
                          setQuantity(val);
                        }
                      }}
                      placeholder="จำนวน"
                      title="จำนวนสินค้า"
                      className="w-16 text-center font-bold border border-slate-200 rounded-lg py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min={min}
                      step={step}
                    />
                    <button
                      onClick={handleIncrement}
                      disabled={
                        product.is_track_stock !== false &&
                        quantity >= product.stock_count
                      }
                      title="เพิ่มจำนวน"
                      aria-label="เพิ่มจำนวนสินค้า"
                      className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-4">
              {isOutOfStock ? (
                <button
                  disabled
                  title="สินค้าหมด"
                  className="w-full bg-slate-100 text-slate-400 font-bold py-3 rounded-lg text-base cursor-not-allowed border border-slate-200"
                >
                  สินค้าหมด
                </button>
              ) : (
                <button
                  onClick={handleAddToCart}
                  title="เพิ่มสินค้าลงตะกร้า"
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all active:scale-95"
                >
                  <ShoppingCart className="w-5 h-5" />
                  เพิ่มลงตะกร้า
                  {isAdded && <Check className="w-5 h-5" />}
                </button>
              )}
              <button
                onClick={onClose}
                title="ปิดหน้านี้"
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 rounded-lg transition-colors"
              >
                ปิด
              </button>
            </div>

            {/* Current Cart Status */}
            {cartQuantity > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-2">
                <Check className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-blue-700">
                  มีอยู่ในตะกร้าแล้ว <span className="font-bold">{Number.isInteger(cartQuantity) ? cartQuantity : cartQuantity.toFixed(2).replace(/\.?0+$/, '')}</span> รายการ
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
