import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ShoppingCart, Search, X, Eye, Plus, Minus, Trash2, ArrowRight,
  Camera, ChevronLeft, BarChart3, Package, ShoppingBag, Users,
  TrendingUp, Edit2, Check, Star, Menu, Box, LogOut, AlertTriangle,
  Maximize2, RotateCcw, Layers, Tag, Home, Sofa
} from "lucide-react";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, getDocs, query, where, setDoc } from "firebase/firestore";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import { db, auth } from "../lib/firebase";

// ─── Types ───────────────────────────────────────────────────────────────────

type Product = {
  docId?: string;
  id: number;
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  image: string;
  modelGlbUrl?: string;
  modelUsdzUrl?: string;
  rating: number;
  reviews: number;
  stock: number;
  description: string;
  dimensions: string;
  material: string;
  colors: string[];
  featured: boolean;
};

type CartItem = { product: Product; quantity: number; color: string };
type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";
type Order = {
  docId?: string;
  id: string; customer: string; email: string;
  items: number; total: number; status: OrderStatus; date: string;
};
type Customer = {
  docId?: string;
  id: number; name: string; email: string;
  orders: number; spent: number; joined: string;
};
type View = "shop" | "product" | "checkout" | "admin" | "login";
type AdminTab = "dashboard" | "products" | "orders" | "customers";

// ─── Data ────────────────────────────────────────────────────────────────────

const INIT_PRODUCTS: Product[] = [];

const INIT_ORDERS: Order[] = [
  { id: "ORD-2024-001", customer: "Emma Harrington", email: "emma@example.com", items: 2, total: 5448, status: "delivered", date: "2024-11-15" },
  { id: "ORD-2024-002", customer: "James Weller", email: "james@example.com", items: 1, total: 2899, status: "shipped", date: "2024-11-18" },
  { id: "ORD-2024-003", customer: "Sofia Merano", email: "sofia@example.com", items: 3, total: 7847, status: "processing", date: "2024-11-20" },
  { id: "ORD-2024-004", customer: "Leon Park", email: "leon@example.com", items: 1, total: 849, status: "pending", date: "2024-11-21" },
  { id: "ORD-2024-005", customer: "Aria Chen", email: "aria@example.com", items: 2, total: 4348, status: "processing", date: "2024-11-22" },
  { id: "ORD-2024-006", customer: "Marco Bianchi", email: "marco@example.com", items: 1, total: 3499, status: "cancelled", date: "2024-11-22" },
];

const INIT_CUSTOMERS: Customer[] = [
  { id: 1, name: "Emma Harrington", email: "emma@example.com", orders: 5, spent: 14280, joined: "2023-03-12" },
  { id: 2, name: "James Weller", email: "james@example.com", orders: 3, spent: 8699, joined: "2023-06-08" },
  { id: 3, name: "Sofia Merano", email: "sofia@example.com", orders: 7, spent: 22104, joined: "2022-11-22" },
  { id: 4, name: "Leon Park", email: "leon@example.com", orders: 1, spent: 849, joined: "2024-11-21" },
  { id: 5, name: "Aria Chen", email: "aria@example.com", orders: 4, spent: 11246, joined: "2023-09-14" },
];

const CATEGORIES = ["All", "Living Room", "Dining", "Bedroom", "Office"];

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) => `NPR ${n.toLocaleString()}`;
const PUBLIC_URL = import.meta.env.VITE_PUBLIC_URL || window.location.origin;
const DEFAULT_AR_MODEL = `${PUBLIC_URL}/models/sofa.glb`;

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={11} className={i <= Math.round(rating) ? "fill-[#C07A4A] text-[#C07A4A]" : "text-border fill-none"} />
      ))}
    </div>
  );
}

// ─── AR QR Button / Modal

function ARQrButton({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const fullUrl = `${PUBLIC_URL}/ar/${product.id}`;

  useEffect(() => {
    if (!open) return;
    // generate QR via api
    const api = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(fullUrl)}`;
    setQrDataUrl(api);
  }, [open, fullUrl]);

  return (
    <div>
      <button onClick={() => setOpen(true)} className="p-1.5 text-muted-foreground hover:text-accent transition-colors">QR</button>
      {open && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border p-6 rounded-lg">
            <h3 className="mb-4 font-medium">Scan to view in AR</h3>
            {qrDataUrl ? <img src={qrDataUrl} alt="QR Code" className="w-64 h-64" /> : <div className="w-64 h-64 bg-secondary" />}
            <div className="mt-4 flex gap-2">
              <a href={fullUrl} target="_blank" rel="noreferrer" className="px-3 py-2 bg-foreground text-background">Open</a>
              <button onClick={() => { navigator.clipboard?.writeText(fullUrl); }} className="px-3 py-2 border">Copy Link</button>
              <button onClick={() => setOpen(false)} className="px-3 py-2 border">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AR Modal ────────────────────────────────────────────────────────────────

function ARModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const [scanning, setScanning] = useState(true);
  const [placed, setPlaced] = useState(false);

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      {/* Simulated camera bg */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1586208958839-06c29e79e6d7?w=1400&h=900&fit=crop&auto=format"
          alt="Room camera view"
          className="w-full h-full object-cover opacity-80"
        />
        {/* Scan grid overlay */}
        <div className="absolute inset-0"
          style={{ backgroundImage: "linear-gradient(rgba(192,122,74,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(192,122,74,0.12) 1px, transparent 1px)", backgroundSize: "40px 40px" }}
        />
        {/* Corner brackets */}
        {[["top-8 left-8 border-t-2 border-l-2",""], ["top-8 right-8 border-t-2 border-r-2",""], ["bottom-8 left-8 border-b-2 border-l-2",""], ["bottom-8 right-8 border-b-2 border-r-2",""]].map(([cls], i) => (
          <div key={i} className={`absolute w-10 h-10 border-[#C07A4A] ${cls}`} />
        ))}

        {/* Placed furniture */}
        {placed && (
          <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 w-72 animate-[fadeIn_0.4s_ease]">
            <img src={product.image} alt={product.name} className="w-full object-contain drop-shadow-2xl" style={{ filter: "drop-shadow(0 30px 20px rgba(0,0,0,0.5))" }} />
            {/* Floor shadow */}
            <div className="mx-auto w-48 h-4 bg-black/30 blur-xl rounded-full -mt-2" />
          </div>
        )}

        {/* Scan animation */}
        {scanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 border-2 border-[#C07A4A] rounded-full animate-ping opacity-60" />
            <p className="text-white text-sm font-mono tracking-widest uppercase">Scanning surface…</p>
          </div>
        )}
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <Camera size={16} className="text-[#C07A4A]" />
          <span className="text-white text-sm font-mono tracking-wider uppercase">AR View</span>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Product info bar */}
      <div className="relative z-10 mt-auto">
        <div className="bg-black/60 backdrop-blur-md px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-white font-medium" style={{ fontFamily: "'Playfair Display', serif" }}>{product.name}</p>
            <p className="text-white/60 text-sm font-mono">{fmt(product.price)}</p>
          </div>
          <div className="flex gap-3">
            {!placed ? (
              <button
                onClick={() => { setScanning(false); setTimeout(() => setPlaced(true), 800); }}
                className="px-5 py-2.5 bg-[#C07A4A] text-white text-sm font-medium tracking-wide hover:bg-[#A86840] transition-colors"
              >
                Place in Room
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setPlaced(false)} className="px-4 py-2.5 bg-white/10 text-white text-sm hover:bg-white/20 transition-colors flex items-center gap-2">
                  <RotateCcw size={14} /> Reset
                </button>
                <button className="px-5 py-2.5 bg-[#C07A4A] text-white text-sm flex items-center gap-2 hover:bg-[#A86840] transition-colors">
                  <Maximize2 size={14} /> Resize
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="bg-black/40 px-6 py-2 flex items-center gap-4 text-white/50 text-xs font-mono">
          <span className="flex items-center gap-1.5"><Layers size={10} /> Depth Mapping Active</span>
          <span className="flex items-center gap-1.5"><Box size={10} /> {product.dimensions}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

function Header({
  cartCount, onCartOpen, onHomeClick, onCategoryClick, activeCategory, transparent = false
}: {
  cartCount: number; onCartOpen: () => void;
  onHomeClick: () => void; onCategoryClick?: (c: string) => void;
  activeCategory?: string; transparent?: boolean;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <header className={`sticky top-0 z-50 ${transparent ? "bg-transparent" : "bg-background/95 backdrop-blur-sm border-b border-border"}`}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
        <button onClick={onHomeClick} className="flex items-center gap-2.5 shrink-0">
          <Sofa size={20} className="text-accent" />
          <span className="text-lg font-semibold tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            Forma<span className="text-accent">.</span>
          </span>
        </button>

        <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          {CATEGORIES.slice(1).map(c => (
            <button
              key={c}
              onClick={() => onCategoryClick?.(c)}
              className={`transition-colors hover:text-foreground ${activeCategory === c ? "text-foreground font-medium border-b border-accent pb-0.5" : ""}`}
            >
              {c}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {searchOpen ? (
            <div className="flex items-center gap-2 border-b border-foreground pb-0.5">
              <Search size={14} className="text-muted-foreground" />
              <input autoFocus className="bg-transparent text-sm outline-none w-36 placeholder:text-muted-foreground" placeholder="Search…" onBlur={() => setSearchOpen(false)} />
            </div>
          ) : (
            <button onClick={() => setSearchOpen(true)} className="p-2 hover:text-accent transition-colors">
              <Search size={18} />
            </button>
          )}
          <button onClick={onCartOpen} className="relative p-2 hover:text-accent transition-colors">
            <ShoppingCart size={18} />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent text-accent-foreground text-[10px] flex items-center justify-center font-mono">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({
  product, onARView, onAddToCart, onClick
}: {
  product: Product; onARView: (p: Product) => void; onAddToCart: (p: Product) => void; onClick: (p: Product) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const discount = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : null;

  return (
    <div
      className="group cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Image */}
      <div className="relative overflow-hidden bg-secondary aspect-[4/5] mb-4" onClick={() => onClick(product)}>
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {discount && (
          <span className="absolute top-3 left-3 bg-accent text-accent-foreground text-[10px] font-mono px-2 py-1 tracking-wider">
            -{discount}%
          </span>
        )}
        {product.stock <= 3 && (
          <span className="absolute top-3 right-3 bg-foreground text-background text-[10px] font-mono px-2 py-1 tracking-wider">
            ONLY {product.stock} LEFT
          </span>
        )}

        {/* Hover actions */}
        <div className={`absolute inset-0 bg-foreground/5 flex flex-col justify-end p-4 gap-2 transition-opacity duration-300 ${hovered ? "opacity-100" : "opacity-0"}`}>
          <button
            onClick={(e) => { e.stopPropagation(); onARView(product); }}
            className="w-full flex items-center justify-center gap-2 bg-white/90 text-foreground text-xs font-medium py-2.5 tracking-wider hover:bg-white transition-colors"
          >
            <Camera size={13} /> VIEW IN AR
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
            className="w-full flex items-center justify-center gap-2 bg-foreground text-background text-xs font-medium py-2.5 tracking-wider hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Plus size={13} /> ADD TO CART
          </button>
        </div>
      </div>

      {/* Info */}
      <div onClick={() => onClick(product)}>
        <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-1">{product.category}</p>
        <h3 className="text-base font-medium mb-1.5 group-hover:text-accent transition-colors" style={{ fontFamily: "'Playfair Display', serif" }}>
          {product.name}
        </h3>
        <div className="flex items-center gap-2 mb-1.5">
          <Stars rating={product.rating} />
          <span className="text-[10px] font-mono text-muted-foreground">({product.reviews})</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-base font-medium">{fmt(product.price)}</span>
          {product.originalPrice && (
            <span className="text-sm line-through text-muted-foreground">{fmt(product.originalPrice)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Cart Sidebar ─────────────────────────────────────────────────────────────

function CartSidebar({
  cart, cartTotal, onClose, onUpdateQty, onRemove, onCheckout
}: {
  cart: CartItem[]; cartTotal: number;
  onClose: () => void; onUpdateQty: (id: number, color: string, d: number) => void;
  onRemove: (id: number, color: string) => void; onCheckout: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[80]" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-card z-[90] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 className="text-lg font-medium" style={{ fontFamily: "'Playfair Display', serif" }}>
            Your Cart <span className="text-muted-foreground font-normal text-sm">({cart.length})</span>
          </h2>
          <button onClick={onClose} className="p-1.5 hover:text-accent transition-colors"><X size={18} /></button>
        </div>

        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <ShoppingCart size={40} strokeWidth={1} />
            <p className="text-sm">Your cart is empty</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {cart.map(item => (
              <div key={`${item.product.id}-${item.color}`} className="flex gap-4">
                <img src={item.product.image} alt={item.product.name} className="w-20 h-24 object-cover bg-secondary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm leading-snug mb-0.5" style={{ fontFamily: "'Playfair Display', serif" }}>{item.product.name}</p>
                  <p className="text-xs text-muted-foreground font-mono mb-2">{item.color}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 border border-border">
                      <button onClick={() => onUpdateQty(item.product.id, item.color, -1)} className="w-8 h-8 flex items-center justify-center hover:bg-secondary transition-colors"><Minus size={12} /></button>
                      <span className="text-sm w-5 text-center font-mono">{item.quantity}</span>
                      <button onClick={() => onUpdateQty(item.product.id, item.color, 1)} className="w-8 h-8 flex items-center justify-center hover:bg-secondary transition-colors"><Plus size={12} /></button>
                    </div>
                    <button onClick={() => onRemove(item.product.id, item.color)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={14} /></button>
                  </div>
                  <p className="text-sm font-medium mt-1.5">{fmt(item.product.price * item.quantity)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {cart.length > 0 && (
          <div className="px-6 py-5 border-t border-border space-y-3">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{fmt(cartTotal)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Shipping</span><span className="text-green-700">Free</span></div>
            <div className="flex justify-between font-medium border-t border-border pt-3">
              <span>Total</span><span>{fmt(cartTotal)}</span>
            </div>
            <button onClick={onCheckout} className="w-full bg-foreground text-background py-3.5 text-sm font-medium tracking-wider hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-center gap-2">
              CHECKOUT <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Product Detail ───────────────────────────────────────────────────────────

function ProductDetail({
  product, selectedColor, setSelectedColor, onARView, onAddToCart, onBack, cartCount, onCartOpen
}: {
  product: Product; selectedColor: string; setSelectedColor: (c: string) => void;
  onARView: () => void; onAddToCart: () => void; onBack: () => void;
  cartCount: number; onCartOpen: () => void;
}) {
  const [qty, setQty] = useState(1);
  return (
    <div className="min-h-screen bg-background">
      <Header cartCount={cartCount} onCartOpen={onCartOpen} onHomeClick={onBack} onCategoryClick={onBack} />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ChevronLeft size={16} /> Back to collection
        </button>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Image */}
          <div className="bg-secondary aspect-square overflow-hidden">
            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
          </div>
          {/* Info */}
          <div className="flex flex-col justify-center">
            <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-3">{product.category}</p>
            <h1 className="text-4xl font-medium mb-3 leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>{product.name}</h1>
            <div className="flex items-center gap-3 mb-5">
              <Stars rating={product.rating} />
              <span className="text-sm text-muted-foreground font-mono">{product.reviews} reviews</span>
            </div>
            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-3xl font-medium">{fmt(product.price)}</span>
              {product.originalPrice && <span className="text-lg line-through text-muted-foreground">{fmt(product.originalPrice)}</span>}
            </div>
            <p className="text-muted-foreground leading-relaxed mb-8 text-sm">{product.description}</p>

            {/* Color */}
            <div className="mb-6">
              <p className="text-xs font-mono tracking-widest uppercase mb-3">Colour — <span className="text-accent">{selectedColor}</span></p>
              <div className="flex gap-2">
                {product.colors.map(c => (
                  <button
                    key={c}
                    onClick={() => setSelectedColor(c)}
                    className={`px-3 py-1.5 text-xs border transition-colors ${selectedColor === c ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center border border-border">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-10 h-10 flex items-center justify-center hover:bg-secondary transition-colors"><Minus size={14} /></button>
                <span className="w-10 text-center font-mono text-sm">{qty}</span>
                <button onClick={() => setQty(qty + 1)} className="w-10 h-10 flex items-center justify-center hover:bg-secondary transition-colors"><Plus size={14} /></button>
              </div>
              <span className="text-xs text-muted-foreground font-mono">{product.stock} in stock</span>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mb-8">
              <button onClick={onAddToCart} className="flex-1 bg-foreground text-background py-3.5 text-sm font-medium tracking-wider hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-center gap-2">
                <Plus size={15} /> ADD TO CART
              </button>
              <button onClick={onARView} className="flex items-center justify-center gap-2 border border-foreground px-5 py-3.5 text-sm font-medium tracking-wider hover:bg-foreground hover:text-background transition-colors">
                <Camera size={15} /> VIEW IN AR
              </button>
            </div>

            {/* Specs */}
            <div className="border-t border-border pt-6 grid grid-cols-2 gap-4 text-sm">
              {[["Dimensions", product.dimensions], ["Material", product.material]].map(([label, val]) => (
                <div key={label}>
                  <p className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase mb-1">{label}</p>
                  <p className="text-sm">{val}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Checkout ─────────────────────────────────────────────────────────────────

function CheckoutPage({
  cart, cartTotal, step, setStep, onPlaceOrder, orderPlaced, onBack
}: {
  cart: CartItem[]; cartTotal: number; step: number; setStep: (s: number) => void;
  onPlaceOrder: () => void; orderPlaced: boolean; onBack: () => void;
}) {
  const [form, setForm] = useState({ name: "", email: "", address: "", city: "", zip: "", card: "", expiry: "", cvv: "" });
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  if (orderPlaced) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
        <Check size={28} className="text-green-700" />
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-medium mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Order Confirmed</h2>
        <p className="text-muted-foreground text-sm">Thank you for your purchase. Redirecting you back to the shop…</p>
      </div>
    </div>
  );

  const steps = ["Shipping", "Payment", "Review"];
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ChevronLeft size={16} /> Continue shopping
        </button>
        <h1 className="text-3xl font-medium mb-8" style={{ fontFamily: "'Playfair Display', serif" }}>Checkout</h1>

        {/* Step indicators */}
        <div className="flex items-center gap-0 mb-10">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`flex items-center gap-2 ${i + 1 <= step ? "text-foreground" : "text-muted-foreground"}`}>
                <div className={`w-6 h-6 flex items-center justify-center text-xs font-mono border ${i + 1 < step ? "bg-foreground border-foreground text-background" : i + 1 === step ? "border-foreground" : "border-border"}`}>
                  {i + 1 < step ? <Check size={12} /> : i + 1}
                </div>
                <span className="text-sm hidden md:block">{s}</span>
              </div>
              {i < steps.length - 1 && <div className={`w-12 md:w-20 h-px mx-2 ${i + 1 < step ? "bg-foreground" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-5">
            {step === 1 && (
              <>
                <h3 className="font-medium mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>Shipping Information</h3>
                {[["Full Name", "name", "text"], ["Email", "email", "email"], ["Address", "address", "text"], ["City", "city", "text"], ["ZIP Code", "zip", "text"]].map(([label, key, type]) => (
                  <div key={key}>
                    <label className="text-xs font-mono tracking-widest uppercase text-muted-foreground block mb-1.5">{label}</label>
                    <input type={type} value={(form as any)[key]} onChange={e => f(key, e.target.value)} className="w-full border border-border bg-transparent px-4 py-2.5 text-sm outline-none focus:border-foreground transition-colors" />
                  </div>
                ))}
                <button onClick={() => setStep(2)} className="w-full bg-foreground text-background py-3.5 text-sm font-medium tracking-wider hover:bg-accent hover:text-accent-foreground transition-colors mt-4">
                  CONTINUE TO PAYMENT
                </button>
              </>
            )}
            {step === 2 && (
              <>
                <h3 className="font-medium mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>Payment Details</h3>
                {[["Card Number", "card", "text", "1234 5678 9012 3456"], ["Expiry", "expiry", "text", "MM / YY"], ["CVV", "cvv", "text", "•••"]].map(([label, key, type, ph]) => (
                  <div key={key}>
                    <label className="text-xs font-mono tracking-widest uppercase text-muted-foreground block mb-1.5">{label}</label>
                    <input type={type} placeholder={ph as string} value={(form as any)[key]} onChange={e => f(key, e.target.value)} className="w-full border border-border bg-transparent px-4 py-2.5 text-sm outline-none focus:border-foreground transition-colors" />
                  </div>
                ))}
                <div className="flex gap-3 mt-4">
                  <button onClick={() => setStep(1)} className="flex-1 border border-border py-3.5 text-sm hover:border-foreground transition-colors">BACK</button>
                  <button onClick={() => setStep(3)} className="flex-1 bg-foreground text-background py-3.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">REVIEW ORDER</button>
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <h3 className="font-medium mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>Review Your Order</h3>
                <div className="space-y-4 border border-border p-4">
                  {cart.map(item => (
                    <div key={`${item.product.id}-${item.color}`} className="flex gap-4">
                      <img src={item.product.image} alt={item.product.name} className="w-16 h-20 object-cover bg-secondary" />
                      <div className="flex-1">
                        <p className="font-medium text-sm" style={{ fontFamily: "'Playfair Display', serif" }}>{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">{item.color} × {item.quantity}</p>
                        <p className="text-sm font-medium mt-1">{fmt(item.product.price * item.quantity)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 mt-4">
                  <button onClick={() => setStep(2)} className="flex-1 border border-border py-3.5 text-sm hover:border-foreground transition-colors">BACK</button>
                  <button onClick={onPlaceOrder} className="flex-1 bg-accent text-accent-foreground py-3.5 text-sm font-medium hover:bg-[#A86840] transition-colors">
                    PLACE ORDER — {fmt(cartTotal)}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Order summary */}
          <div className="bg-card border border-border p-6 h-fit space-y-4">
            <h3 className="font-medium text-sm" style={{ fontFamily: "'Playfair Display', serif" }}>Order Summary</h3>
            {cart.map(item => (
              <div key={`${item.product.id}-${item.color}`} className="flex justify-between text-sm text-muted-foreground">
                <span className="truncate max-w-[60%]">{item.product.name} ×{item.quantity}</span>
                <span>{fmt(item.product.price * item.quantity)}</span>
              </div>
            ))}
            <div className="border-t border-border pt-3 flex justify-between font-medium">
              <span>Total</span><span>{fmt(cartTotal)}</span>
            </div>
            <p className="text-xs text-muted-foreground font-mono">Free delivery on all orders</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shop View ────────────────────────────────────────────────────────────────

function ShopView({
  products, categories, activeCategory, setActiveCategory, searchQuery, setSearchQuery,
  cartCount, onCartOpen, onProductClick, onARView, onAddToCart, loading
}: {
  products: Product[]; categories: string[]; activeCategory: string;
  setActiveCategory: (c: string) => void; searchQuery: string;
  setSearchQuery: (q: string) => void; cartCount: number;
  onCartOpen: () => void; onProductClick: (p: Product) => void;
  onARView: (p: Product) => void; onAddToCart: (p: Product) => void;
  loading: boolean;
}) {
  const featured = products.filter(p => p.featured)[0];

  const scrollToProducts = () => {
    document.getElementById("product-grid")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        cartCount={cartCount}
        onCartOpen={onCartOpen}
        onHomeClick={() => setActiveCategory("All")}
        onCategoryClick={(c) => { setActiveCategory(c); scrollToProducts(); }}
        activeCategory={activeCategory}
      />

      {/* Hero */}
      <section className="relative h-[75vh] overflow-hidden bg-[#1C1814]">
        <img
          src="https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1600&h=900&fit=crop&auto=format"
          alt="Featured furniture"
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 flex flex-col justify-end px-10 pb-16 max-w-7xl mx-auto">
          <p className="text-[#C07A4A] text-xs font-mono tracking-widest uppercase mb-4">New Collection — Autumn 2024</p>
          <h1 className="text-5xl md:text-7xl font-medium text-white leading-tight mb-5 max-w-2xl" style={{ fontFamily: "'Playfair Display', serif" }}>
            Designed for<br /><em>Living Well</em>
          </h1>
          <p className="text-white/60 text-base mb-8 max-w-md leading-relaxed">
            Furniture that earns its place — crafted with intention, built to last generations.
          </p>
          <div className="flex items-center gap-4">
            <button onClick={scrollToProducts} className="bg-[#C07A4A] text-white px-8 py-3.5 text-sm font-medium tracking-wider hover:bg-[#A86840] transition-colors flex items-center gap-2">
              EXPLORE COLLECTION <ArrowRight size={15} />
            </button>
            {featured && (
              <button
                onClick={() => onARView(featured)}
                className="border border-white/40 text-white px-6 py-3.5 text-sm font-medium tracking-wider hover:border-white transition-colors flex items-center gap-2"
              >
                <Camera size={15} /> VIEW IN AR
              </button>
            )}
          </div>
        </div>
        {/* Scroll cue */}
        <div className="absolute bottom-6 right-10 flex items-center gap-2 text-white/40 text-xs font-mono tracking-widest">
          <div className="w-8 h-px bg-white/40" /> SCROLL
        </div>
      </section>

      {/* Features strip */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-center gap-10 flex-wrap text-xs font-mono text-muted-foreground tracking-widest">
          {["FREE DELIVERY ON ALL ORDERS", "10-YEAR CRAFTSMANSHIP GUARANTEE", "AR PREVIEW AVAILABLE", "60-DAY FREE RETURNS"].map(f => (
            <span key={f} className="flex items-center gap-2"><span className="w-1 h-1 bg-accent rounded-full" />{f}</span>
          ))}
        </div>
      </div>

      {/* Filter & Search */}
      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={`px-4 py-2 text-xs font-mono tracking-wider transition-colors ${activeCategory === c ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              {c.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 border-b border-border pb-1">
          <Search size={13} className="text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search products…"
            className="bg-transparent text-sm outline-none w-48 placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Product Grid */}
      <section id="product-grid" className="max-w-7xl mx-auto px-6 pb-20">
        {loading ? (
          <div className="py-24 text-center text-muted-foreground">
            <p className="text-sm font-mono">Loading products...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="py-24 text-center text-muted-foreground">
            <p className="text-sm font-mono">No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12">
            {products.map(p => (
              <ProductCard key={p.id} product={p} onARView={onARView} onAddToCart={onAddToCart} onClick={onProductClick} />
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-foreground text-background">
        <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { title: "Forma", items: ["About us", "Sustainability", "Careers", "Press"] },
            { title: "Collections", items: ["Living Room", "Dining", "Bedroom", "Office"] },
            { title: "Support", items: ["Delivery & Returns", "Assembly Guides", "Care Instructions", "Contact"] },
            { title: "Connect", items: ["Instagram", "Pinterest", "Newsletter", "Showrooms"] },
          ].map(col => (
            <div key={col.title}>
              <p className="text-xs font-mono tracking-widest text-white/40 uppercase mb-4">{col.title}</p>
              <ul className="space-y-2">
                {col.items.map(i => <li key={i} className="text-sm text-white/60 hover:text-white cursor-pointer transition-colors">{i}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 px-6 py-4 max-w-7xl mx-auto flex items-center justify-between text-[11px] font-mono text-white/30">
          <span>© 2024 Forma. All rights reserved.</span>
          <span>Crafted with care.</span>
        </div>
      </footer>
    </div>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────

function AdminPanel({
  tab, setTab, products, orders, customers, totalRevenue, pendingOrders,
  cartCount, onBack, onDeleteProduct, onUpdateOrderStatus, onDeleteOrder, onDeleteCustomer,
  editingProduct, setEditingProduct, showAddProduct, setShowAddProduct, onSaveProduct,
  onSignOut, currentUser, showNotif, onSyncModels
}: {
  tab: AdminTab; setTab: (t: AdminTab) => void;
  products: Product[]; orders: Order[]; customers: Customer[];
  totalRevenue: number; pendingOrders: number; cartCount: number;
  onBack: () => void;
  onDeleteProduct: (id: number) => void;
  onUpdateOrderStatus: (id: string, s: OrderStatus) => void;
  onDeleteOrder: (id: string) => void;
  onDeleteCustomer: (id: number) => void;
  editingProduct: Product | null; setEditingProduct: (p: Product | null) => void;
  showAddProduct: boolean; setShowAddProduct: (v: boolean) => void;
  onSaveProduct: (p: Product) => void;
  onSignOut: () => void;
  currentUser: User | null;
  showNotif: (msg: string) => void;
  onSyncModels?: () => Promise<void>;
}) {
  const navItems: { id: AdminTab; icon: typeof BarChart3; label: string }[] = [
    { id: "dashboard", icon: BarChart3, label: "Dashboard" },
    { id: "products", icon: Package, label: "Products" },
    { id: "orders", icon: ShoppingBag, label: "Orders" },
    { id: "customers", icon: Users, label: "Customers" },
  ];

  return (
    <div className="min-h-screen flex bg-background" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Sidebar */}
      <aside className="w-60 bg-sidebar text-sidebar-foreground flex flex-col shrink-0">
        <div className="px-6 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <Sofa size={18} className="text-sidebar-primary" />
            <span className="font-semibold" style={{ fontFamily: "'Playfair Display', serif" }}>Forma<span className="text-sidebar-primary">.</span></span>
          </div>
          <p className="text-[10px] font-mono text-sidebar-foreground/40 tracking-widest mt-1 uppercase">Admin Panel</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors rounded-sm ${tab === id ? "bg-sidebar-accent text-sidebar-primary font-medium" : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"}`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </nav>
        <div className="px-3 pb-4 border-t border-sidebar-border pt-3">
          <button onClick={onBack} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">
            <Home size={15} /> View Store
          </button>
          <button onClick={onSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <div className="border-b border-border px-8 py-4 flex items-center justify-between bg-card/50">
          <div>
            <h1 className="text-lg font-medium capitalize" style={{ fontFamily: "'Playfair Display', serif" }}>{tab}</h1>
            <p className="text-xs text-muted-foreground font-mono">Forma Admin — {new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          </div>
          <div className="flex items-center gap-3">
            {onSyncModels && (
              <button
                onClick={async () => {
                  showNotif("Syncing AR models...");
                  await onSyncModels();
                  showNotif("✓ AR models synced!");
                }}
                className="text-xs bg-blue-100 text-blue-800 px-3 py-1.5 font-mono hover:bg-blue-200 transition-colors"
              >
                Sync AR Models
              </button>
            )}
            {pendingOrders > 0 && (
              <span className="flex items-center gap-1.5 text-xs bg-amber-100 text-amber-800 px-3 py-1.5 font-mono">
                <AlertTriangle size={11} /> {pendingOrders} pending
              </span>
            )}
            <div className="w-8 h-8 bg-accent text-accent-foreground flex items-center justify-center text-xs font-medium">A</div>
          </div>
        </div>

        <div className="px-8 py-6">
          {tab === "dashboard" && <DashboardTab products={products} orders={orders} customers={customers} totalRevenue={totalRevenue} pendingOrders={pendingOrders} />}
          {tab === "products" && (
            <ProductsTab
              products={products}
              onDelete={onDeleteProduct}
              onEdit={setEditingProduct}
              onAdd={() => { setEditingProduct(null); setShowAddProduct(true); }}
              editing={editingProduct}
              showAdd={showAddProduct}
              onSave={onSaveProduct}
              onCancel={() => { setEditingProduct(null); setShowAddProduct(false); }}
              showNotif={showNotif}
            />
          )}
          {tab === "orders" && <OrdersTab orders={orders} onUpdateStatus={onUpdateOrderStatus} onDelete={onDeleteOrder} />}
          {tab === "customers" && <CustomersTab customers={customers} onDelete={onDeleteCustomer} />}
        </div>
      </main>
    </div>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function DashboardTab({ products, orders, customers, totalRevenue, pendingOrders }: {
  products: Product[]; orders: Order[]; customers: Customer[];
  totalRevenue: number; pendingOrders: number;
}) {
  const stats = [
    { label: "Total Revenue", value: fmt(totalRevenue), icon: TrendingUp, change: "+12.4%", positive: true },
    { label: "Total Orders", value: orders.length.toString(), icon: ShoppingBag, change: "+8 this month", positive: true },
    { label: "Products", value: products.length.toString(), icon: Package, change: `${products.filter(p => p.stock <= 5).length} low stock`, positive: false },
    { label: "Customers", value: customers.length.toString(), icon: Users, change: "+2 this week", positive: true },
  ];

  const monthlyData = [
    { m: "Jul", v: 42000 }, { m: "Aug", v: 58000 }, { m: "Sep", v: 51000 },
    { m: "Oct", v: 67000 }, { m: "Nov", v: totalRevenue }, { m: "Dec", v: 0 },
  ];
  const maxVal = Math.max(...monthlyData.map(d => d.v));

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map(s => (
          <div key={s.label} className="bg-card border border-border p-5">
            <div className="flex items-start justify-between mb-4">
              <p className="text-xs font-mono text-muted-foreground tracking-wider uppercase">{s.label}</p>
              <s.icon size={16} className="text-muted-foreground" />
            </div>
            <p className="text-2xl font-medium mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>{s.value}</p>
            <p className={`text-xs font-mono ${s.positive ? "text-green-700" : "text-amber-700"}`}>{s.change}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <div className="lg:col-span-2 bg-card border border-border p-6">
          <h3 className="text-sm font-medium mb-6" style={{ fontFamily: "'Playfair Display', serif" }}>Revenue Overview</h3>
          <div className="flex items-end gap-3 h-36">
            {monthlyData.map(d => (
              <div key={d.m} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full bg-accent/20 hover:bg-accent/40 transition-colors cursor-default"
                  style={{ height: d.v > 0 ? `${Math.round((d.v / maxVal) * 100)}%` : "4px" }}
                  title={d.v > 0 ? fmt(d.v) : "—"}
                />
                <span className="text-[10px] font-mono text-muted-foreground">{d.m}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category breakdown */}
        <div className="bg-card border border-border p-6">
          <h3 className="text-sm font-medium mb-6" style={{ fontFamily: "'Playfair Display', serif" }}>By Category</h3>
          <div className="space-y-3">
            {CATEGORIES.slice(1).map(cat => {
              const count = products.filter(p => p.category === cat).length;
              const pct = Math.round((count / products.length) * 100);
              return (
                <div key={cat}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-mono text-muted-foreground">{cat}</span>
                    <span className="font-mono">{count}</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent orders */}
      <div className="bg-card border border-border">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-medium" style={{ fontFamily: "'Playfair Display', serif" }}>Recent Orders</h3>
          <span className="text-xs text-muted-foreground font-mono">Last 7 days</span>
        </div>
        <div className="divide-y divide-border">
          {orders.slice(0, 5).map(o => (
            <div key={o.id} className="px-6 py-3.5 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{o.customer}</p>
                <p className="text-xs text-muted-foreground font-mono">{o.id} · {o.date}</p>
              </div>
              <span className={`text-[10px] font-mono px-2.5 py-1 tracking-wider ${STATUS_STYLES[o.status]}`}>{o.status.toUpperCase()}</span>
              <span className="text-sm font-medium font-mono w-20 text-right">{fmt(o.total)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Low stock */}
      {products.filter(p => p.stock <= 5).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-amber-700" />
            <p className="text-xs font-mono text-amber-800 tracking-wider uppercase font-medium">Low Stock Alert</p>
          </div>
          <div className="space-y-1.5">
            {products.filter(p => p.stock <= 5).map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span>{p.name}</span>
                <span className="font-mono text-amber-800">{p.stock} remaining</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AR View Page ────────────────────────────────────────────────────────────

function ArView({ product }: { product?: Product | null }) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mountRef.current || !product) return;
    // load model-viewer script if not present
    const existing = document.querySelector('script[data-model-viewer]');
    if (!existing) {
      const s = document.createElement('script');
      s.setAttribute('type', 'module');
      s.setAttribute('data-model-viewer', '1');
      s.src = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js';
      document.head.appendChild(s);
    }

    const modelSrc = product.modelGlbUrl || DEFAULT_AR_MODEL;
    const iosSrc = product.modelUsdzUrl || '';

    const html = `
      <div style="height:100vh; display:flex; flex-direction:column;">
        <div style="padding:12px; display:flex; align-items:center; gap:12px; background:#111; color:#fff;">
          <button id="ar-back" style="background:transparent;border:0;color:#fff;padding:6px;cursor:pointer;">Back</button>
          <div style="font-weight:600">AR View${product ? ' — ' + product.name : ''}</div>
        </div>
        <div style="flex:1; display:flex; align-items:center; justify-content:center; background:#000;">
          <model-viewer src="${modelSrc}" ios-src="${iosSrc}" alt="${product?.name || 'Product'}" ar ar-modes="webxr scene-viewer quick-look" camera-controls style="width:100%;height:100%;"></model-viewer>
        </div>
      </div>
    `;

    mountRef.current.innerHTML = html;

    const backBtn = mountRef.current.querySelector('#ar-back');
    backBtn?.addEventListener('click', () => window.history.back());

    return () => {
      mountRef.current && (mountRef.current.innerHTML = '');
    };
  }, [product]);

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground px-6 text-center">
        <div>
          <p className="mb-2 text-sm">Preparing AR view for this product.</p>
          <p className="text-xs">If the product does not load, verify the scanned QR link and product data.</p>
        </div>
      </div>
    );
  }

  return <div ref={mountRef} />;
}

// ─── Products Tab ─────────────────────────────────────────────────────────────

function ProductsTab({
  products, onDelete, onEdit, onAdd, editing, showAdd, onSave, onCancel, showNotif
}: {
  products: Product[]; onDelete: (id: number) => void; onEdit: (p: Product) => void;
  onAdd: () => void; editing: Product | null; showAdd: boolean;
  onSave: (p: Product) => void; onCancel: () => void;
  showNotif: (msg: string) => void;
}) {
  const blank: Product = useMemo(() => ({
    id: 0, name: "", category: "Living Room", price: 0, image: "",
    rating: 4.5, reviews: 0, stock: 10, description: "",
    dimensions: "", material: "", colors: ["Natural"], featured: false,
  }), []);
  const [form, setForm] = useState<Product>(editing || blank);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const glbInputRef = useRef<HTMLInputElement | null>(null);
  const usdzInputRef = useRef<HTMLInputElement | null>(null);
  const [glbProgress, setGlbProgress] = useState<number | null>(null);
  const [usdzProgress, setUsdzProgress] = useState<number | null>(null);

  useEffect(() => {
    setForm(editing ?? blank);
  }, [editing, blank]);

  const f = (k: keyof Product, v: any) => setForm(p => ({ ...p, [k]: v }));

  const updateImageFromFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        f("image", reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) updateImageFromFile(file);
  };

  const handleImageDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) updateImageFromFile(file);
  };

  const uploadModel = async (file: File, kind: "glb" | "usdz") => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) {
      showNotif("Cloudinary upload is not configured. Paste a public URL instead.");
      return;
    }

    const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", uploadPreset);
    data.append("resource_type", "auto");
    data.append("public_id", `models/${Date.now()}-${file.name}`);

    if (kind === "glb") setGlbProgress(0);
    else setUsdzProgress(0);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: data,
      });
      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }
      const result = await response.json();
      const url = result.secure_url as string;
      if (kind === "glb") {
        f('modelGlbUrl', url);
        setGlbProgress(null);
      } else {
        f('modelUsdzUrl', url);
        setUsdzProgress(null);
      }
    } catch (error) {
      console.error("Cloudinary upload failed", error);
      if (kind === "glb") setGlbProgress(null);
      else setUsdzProgress(null);
      showNotif("Cloudinary upload failed. Check config and preset.");
    }
  };

  const handleModelSelect = (e: ChangeEvent<HTMLInputElement>, kind: "glb" | "usdz") => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadModel(file, kind);
  };

  if (editing || showAdd) {
    const isEdit = !!editing;
    return (
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft size={18} /></button>
          <h2 className="text-lg font-medium" style={{ fontFamily: "'Playfair Display', serif" }}>{isEdit ? "Edit Product" : "Add New Product"}</h2>
        </div>
        <div className="bg-card border border-border p-6 space-y-5">
          {[
            { label: "Product Name", key: "name" as const, type: "text" },
            { label: "Price (USD)", key: "price" as const, type: "number" },
            { label: "Stock", key: "stock" as const, type: "number" },
            { label: "Dimensions", key: "dimensions" as const, type: "text" },
            { label: "Material", key: "material" as const, type: "text" },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label className="text-xs font-mono tracking-widest uppercase text-muted-foreground block mb-1.5">{label}</label>
              <input
                type={type}
                value={(form as any)[key]}
                onChange={e => f(key, type === "number" ? Number(e.target.value) : e.target.value)}
                className="w-full border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground transition-colors"
              />
            </div>
          ))}
          <div>
            <label className="text-xs font-mono tracking-widest uppercase text-muted-foreground block mb-1.5">Product image</label>
            <div
              className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer transition-colors hover:border-foreground"
              onDragOver={e => e.preventDefault()}
              onDrop={handleImageDrop}
              onClick={() => imageInputRef.current?.click()}
            >
              {form.image ? (
                <img src={form.image} alt="Product preview" className="mx-auto max-h-40 object-contain" />
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Drag and drop an image here, or click to select a file.</p>
                  <p className="text-xs text-muted-foreground">Supported formats: JPG, PNG, GIF</p>
                </div>
              )}
            </div>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
          </div>

          <div>
            <label className="text-xs font-mono tracking-widest uppercase text-muted-foreground block mb-1.5">3D Model (GLB)</label>
            <div className="flex items-center gap-3">
              <input ref={glbInputRef} type="file" accept=".glb,model/gltf-binary" className="hidden" onChange={e => handleModelSelect(e, 'glb')} />
              <button onClick={() => glbInputRef.current?.click()} className="px-3 py-2 border">Upload GLB</button>
              {form.modelGlbUrl && <a href={form.modelGlbUrl} target="_blank" rel="noreferrer" className="text-sm">View</a>}
              {glbProgress !== null && <span className="text-sm">Uploading: {glbProgress}%</span>}
            </div>
            <input
              type="url"
              value={form.modelGlbUrl ?? ""}
              onChange={e => f("modelGlbUrl", e.target.value)}
              placeholder="https://example.com/model.glb"
              className="mt-3 w-full border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-mono tracking-widest uppercase text-muted-foreground block mb-1.5">3D Model (USDZ) — iOS Quick Look</label>
            <div className="flex items-center gap-3">
              <input ref={usdzInputRef} type="file" accept=".usdz,model/vnd.usdz+zip" className="hidden" onChange={e => handleModelSelect(e, 'usdz')} />
              <button onClick={() => usdzInputRef.current?.click()} className="px-3 py-2 border">Upload USDZ</button>
              {form.modelUsdzUrl && <a href={form.modelUsdzUrl} target="_blank" rel="noreferrer" className="text-sm">View</a>}
              {usdzProgress !== null && <span className="text-sm">Uploading: {usdzProgress}%</span>}
            </div>
            <input
              type="url"
              value={form.modelUsdzUrl ?? ""}
              onChange={e => f("modelUsdzUrl", e.target.value)}
              placeholder="https://example.com/model.usdz"
              className="mt-3 w-full border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-mono tracking-widest uppercase text-muted-foreground block mb-1.5">Category</label>
            <select value={form.category} onChange={e => f("category", e.target.value)} className="w-full border border-border bg-background px-3 py-2 text-sm outline-none">
              {CATEGORIES.slice(1).map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-mono tracking-widest uppercase text-muted-foreground block mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => f("description", e.target.value)} rows={3} className="w-full border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground transition-colors resize-none" />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="featured" checked={form.featured} onChange={e => f("featured", e.target.checked)} className="w-4 h-4 accent-accent" />
            <label htmlFor="featured" className="text-sm">Featured product</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onCancel} className="flex-1 border border-border py-2.5 text-sm hover:border-foreground transition-colors">Cancel</button>
            <button onClick={() => onSave(form)} className="flex-1 bg-foreground text-background py-2.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
              {isEdit ? "Save Changes" : "Add Product"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground font-mono">{products.length} products</p>
        <button onClick={onAdd} className="flex items-center gap-2 bg-foreground text-background px-4 py-2.5 text-xs font-mono tracking-wider hover:bg-accent hover:text-accent-foreground transition-colors">
          <Plus size={13} /> ADD PRODUCT
        </button>
      </div>
      <div className="bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Product", "Category", "Price", "Stock", "Status", "Actions"].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[10px] font-mono tracking-widest text-muted-foreground uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map(p => (
                <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3.5 flex items-center gap-3">
                    <img src={p.image} alt={p.name} className="w-10 h-12 object-cover bg-secondary shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">ID: {p.id}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-xs font-mono text-muted-foreground">{p.category}</td>
                  <td className="px-5 py-3.5 text-sm font-medium">{fmt(p.price)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-mono px-2 py-1 ${p.stock <= 5 ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                      {p.stock} units
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[10px] font-mono px-2 py-1 ${p.featured ? "bg-accent/20 text-accent" : "bg-secondary text-muted-foreground"}`}>
                      {p.featured ? "FEATURED" : "STANDARD"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setForm(p); onEdit(p); }} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"><Edit2 size={13} /></button>
                      <button onClick={() => onDelete(p.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={13} /></button>
                      <ARQrButton product={p} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Orders Tab ───────────────────────────────────────────────────────────────

function OrdersTab({ orders, onUpdateStatus, onDelete }: { orders: Order[]; onUpdateStatus: (id: string, s: OrderStatus) => void; onDelete: (id: string) => void }) {
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);

  return (
    <div>
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {(["all", "pending", "processing", "shipped", "delivered", "cancelled"] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-[10px] font-mono tracking-wider transition-colors ${filter === s ? "bg-foreground text-background" : "border border-border text-muted-foreground hover:border-foreground"}`}
          >
            {s.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                { ["Order ID", "Customer", "Date", "Items", "Total", "Status", "Update / Delete"].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[10px] font-mono tracking-widest text-muted-foreground uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(o => (
                <tr key={o.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-4 text-xs font-mono text-muted-foreground">{o.id}</td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium">{o.customer}</p>
                    <p className="text-xs text-muted-foreground">{o.email}</p>
                  </td>
                  <td className="px-5 py-4 text-xs font-mono text-muted-foreground">{o.date}</td>
                  <td className="px-5 py-4 text-sm">{o.items}</td>
                  <td className="px-5 py-4 text-sm font-medium font-mono">{fmt(o.total)}</td>
                  <td className="px-5 py-4">
                    <span className={`text-[10px] font-mono px-2.5 py-1 ${STATUS_STYLES[o.status]}`}>{o.status.toUpperCase()}</span>
                  </td>
                  <td className="px-5 py-4 flex items-center gap-2">
                    <select
                      value={o.status}
                      onChange={e => onUpdateStatus(o.id, e.target.value as OrderStatus)}
                      className="text-xs font-mono border border-border bg-background px-2 py-1.5 outline-none"
                    >
                      {(["pending", "processing", "shipped", "delivered", "cancelled"] as OrderStatus[]).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button onClick={() => onDelete(o.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Customers Tab ────────────────────────────────────────────────────────────

function CustomersTab({ customers, onDelete }: { customers: Customer[]; onDelete: (id: number) => void }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground font-mono mb-6">{customers.length} registered customers</p>
      <div className="bg-card border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              {["Customer", "Email", "Orders", "Total Spent", "Member Since", "Actions"].map(h => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-mono tracking-widest text-muted-foreground uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {customers.map(c => (
                <tr key={c.id} className="hover:bg-secondary/30 transition-colors">
                <td className="px-5 py-4 flex items-center gap-3">
                  <div className="w-8 h-8 bg-accent/20 text-accent flex items-center justify-center text-xs font-medium shrink-0">
                    {c.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <span className="text-sm font-medium">{c.name}</span>
                </td>
                <td className="px-5 py-4 text-sm text-muted-foreground">{c.email}</td>
                <td className="px-5 py-4 text-sm font-mono">{c.orders}</td>
                <td className="px-5 py-4 text-sm font-medium font-mono">{fmt(c.spent)}</td>
                <td className="px-5 py-4 text-xs font-mono text-muted-foreground">{c.joined}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => onDelete(c.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState<View>("shop");
  const [adminTab, setAdminTab] = useState<AdminTab>("dashboard");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedColor, setSelectedColor] = useState("");
  const [arProduct, setArProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orders, setOrders] = useState<Order[]>(INIT_ORDERS);
  const [customers, setCustomers] = useState<Customer[]>(INIT_CUSTOMERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [arProductState, setArProductState] = useState<Product | null>(null);
  const [qrProduct, setQrProduct] = useState<Product | null>(null);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const totalRevenue = orders.filter(o => o.status !== "cancelled").reduce((s, o) => s + o.total, 0);
  const pendingOrders = orders.filter(o => o.status === "pending" || o.status === "processing").length;

  const showNotif = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const filteredProducts = products.filter(p => {
    const matchCat = activeCategory === "All" || p.category === activeCategory;
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const location = useLocation();
  const navigate = useNavigate();
  const initialRouteSync = useRef(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, currentUser => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    const unsubscribeProducts = onSnapshot(collection(db, "products"), snapshot => {
      try {
        const items: Product[] = snapshot.docs.map(docSnap => {
          const data = docSnap.data() as any;
          return {
            docId: docSnap.id,
            id: typeof data.id === "number" ? data.id : Number(data.id) || Date.now(),
            name: data.name || "",
            category: data.category || "Living Room",
            price: Number(data.price || 0),
            originalPrice: data.originalPrice !== undefined ? Number(data.originalPrice) : undefined,
            image: data.image || "",
            modelGlbUrl: data.modelGlbUrl || undefined,
            modelUsdzUrl: data.modelUsdzUrl || undefined,
            rating: Number(data.rating || 0),
            reviews: Number(data.reviews || 0),
            stock: Number(data.stock || 0),
            description: data.description || "",
            dimensions: data.dimensions || "",
            material: data.material || "",
            colors: Array.isArray(data.colors) ? data.colors : ["Natural"],
            featured: Boolean(data.featured),
          };
        });
        // merge Firestore items with any local fallback items
        const localItems = loadLocalProducts();
        // ensure no duplicate IDs (prefer Firestore)
        const merged = [...items];
        for (const lp of localItems) {
          if (!merged.find(m => m.docId === lp.docId && lp.docId?.toString().startsWith("local-"))) {
            merged.push(lp);
          }
        }
        setProducts(merged);
        setLoadingProducts(false);
      } catch (err) {
        console.error("Failed to process Firestore products", err);
        // fallback to local only
        setProducts(loadLocalProducts());
        setLoadingProducts(false);
      }
    }, error => {
      console.error("Failed to load Firestore products", error);
      // fallback to local products when Firestore query fails (permissions/offline)
      setProducts(loadLocalProducts());
      setLoadingProducts(false);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeProducts();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setOrders(INIT_ORDERS);
      setCustomers(INIT_CUSTOMERS);
      return;
    }

    const unsubscribeOrders = onSnapshot(collection(db, "orders"), snapshot => {
      try {
        const items: Order[] = snapshot.docs.map(docSnap => {
          const data = docSnap.data() as any;
          return {
            docId: docSnap.id,
            id: data.id || docSnap.id,
            customer: data.customer || data.name || "",
            email: data.email || "",
            items: Number(data.items || 0),
            total: Number(data.total || 0),
            status: (data.status || "pending") as OrderStatus,
            date: data.date || new Date().toLocaleDateString(),
          };
        });
        const local = loadLocalOrders();
        const merged = [...items];
        for (const lp of local) if (!merged.find(m => m.docId === lp.docId)) merged.push(lp);
        setOrders(merged);
      } catch (err) {
        console.error("Failed to process Firestore orders", err);
        setOrders(loadLocalOrders());
      }
    }, error => {
      console.error("Failed to load Firestore orders", error);
      setOrders(loadLocalOrders());
    });

    const unsubscribeCustomers = onSnapshot(collection(db, "customers"), snapshot => {
      try {
        const items: Customer[] = snapshot.docs.map(docSnap => {
          const data = docSnap.data() as any;
          return {
            docId: docSnap.id,
            id: Number(data.id || docSnap.id) || Date.now(),
            name: data.name || "",
            email: data.email || "",
            orders: Number(data.orders || 0),
            spent: Number(data.spent || 0),
            joined: data.joined || new Date().toLocaleDateString(),
          };
        });
        const local = loadLocalCustomers();
        const merged = [...items];
        for (const lc of local) if (!merged.find(m => m.docId === lc.docId)) merged.push(lc);
        setCustomers(merged);
      } catch (err) {
        console.error("Failed to process Firestore customers", err);
        setCustomers(loadLocalCustomers());
      }
    }, error => {
      console.error("Failed to load Firestore customers", error);
      setCustomers(loadLocalCustomers());
    });

    return () => {
      unsubscribeOrders();
      unsubscribeCustomers();
    };
  }, [user]);

  // Handle /ar/:id deep links: find product locally or fetch from Firestore
  useEffect(() => {
    const m = location.pathname.match(/^\/ar\/(.+)/);
    if (!m) {
      setArProductState(null);
      return;
    }
    const idStr = m[1];
    const found = products.find(p => String(p.id) === idStr || p.docId === idStr);
    if (found) {
      setArProductState(found);
      return;
    }

    // try fetching from Firestore by `id` numeric
    (async () => {
      try {
        const num = Number(idStr);
        if (!Number.isNaN(num)) {
          const q = query(collection(db, "products"), where("id", "==", num));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const docSnap = snap.docs[0];
            const data = docSnap.data() as any;
            const p: Product = {
              docId: docSnap.id,
              id: typeof data.id === "number" ? data.id : Number(data.id) || Date.now(),
              name: data.name || "",
              category: data.category || "Living Room",
              price: Number(data.price || 0),
              originalPrice: data.originalPrice !== undefined ? Number(data.originalPrice) : undefined,
              image: data.image || "",
              modelGlbUrl: data.modelGlbUrl || undefined,
              modelUsdzUrl: data.modelUsdzUrl || undefined,
              rating: Number(data.rating || 0),
              reviews: Number(data.reviews || 0),
              stock: Number(data.stock || 0),
              description: data.description || "",
              dimensions: data.dimensions || "",
              material: data.material || "",
              colors: Array.isArray(data.colors) ? data.colors : ["Natural"],
              featured: Boolean(data.featured),
            };
            setArProductState(p);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to fetch product for AR route", err);
      }
      setArProductState(null);
    })();
  }, [location.pathname, products]);

  useEffect(() => {
    if (view === "admin" && !user && !authLoading) {
      setView("login");
    }
    if (view === "login" && user) {
      setView("admin");
    }
  }, [view, user, authLoading]);

  useEffect(() => {
    switch (location.pathname) {
      case "/login/admin":
        if (view !== "login") setView("login");
        break;
      case "/admin":
        if (view !== "admin") setView("admin");
        break;
      case "/checkout":
        if (view !== "checkout") setView("checkout");
        break;
      case "/product":
        if (view !== "product") setView("product");
        break;
      case "/ar":
      case "/ar/":
        if (view !== "product") setView("product");
        break;
      default:
        if (view !== "shop") setView("shop");
        break;
    }
  }, [location.pathname]);

  useEffect(() => {
    if (initialRouteSync.current) {
      initialRouteSync.current = false;
      return;
    }

    switch (view) {
      case "login":
        if (location.pathname !== "/login/admin") navigate("/login/admin", { replace: true });
        break;
      case "admin":
        if (location.pathname !== "/admin") navigate("/admin", { replace: true });
        break;
      case "checkout":
        if (location.pathname !== "/checkout") navigate("/checkout", { replace: true });
        break;
      case "product":
        if (!location.pathname.startsWith("/product") && !location.pathname.startsWith("/ar")) navigate("/product", { replace: true });
        break;
      default:
        if (location.pathname !== "/") navigate("/", { replace: true });
        break;
    }
  }, [view, location.pathname, navigate]);

  const addToCart = (product: Product, color: string) => {
    setCart(prev => {
      const ex = prev.find(i => i.product.id === product.id && i.color === color);
      if (ex) return prev.map(i => i.product.id === product.id && i.color === color ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1, color }];
    });
    showNotif(`${product.name} added to cart`);
    setCartOpen(true);
  };

  const updateCartQty = (id: number, color: string, delta: number) =>
    setCart(prev => prev.map(i => i.product.id === id && i.color === color ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter(i => i.quantity > 0));

  // Sync product GLB model URLs
  const syncProductModels = async () => {
    const PUBLIC_URL = import.meta.env.VITE_PUBLIC_URL || window.location.origin;
    const modelMap: Record<string, string> = {
      "Ladder": `${PUBLIC_URL}/models/ladder.glb`,
      "Bed": `${PUBLIC_URL}/models/bed.glb`,
      "Chair": `${PUBLIC_URL}/models/chair.glb`,
      "Stand": `${PUBLIC_URL}/models/Stand.glb`,
      "Sofa": `${PUBLIC_URL}/models/sofa.glb`,
    };

    if (!user) return;

    try {
      const snap = await getDocs(collection(db, "products"));
      for (const docSnap of snap.docs) {
        const data = docSnap.data() as any;
        const productName = data.name || "";
        const modelUrl = modelMap[productName];
        
        // Update if product doesn't have modelGlbUrl and we know the model
        if (modelUrl && !data.modelGlbUrl) {
          await updateDoc(doc(db, "products", docSnap.id), {
            modelGlbUrl: modelUrl,
          });
          console.log(`✓ Updated ${productName} with model URL`);
        }
      }
    } catch (err) {
      console.warn("Failed to sync product models", err);
    }
  };

  const createProduct = async (product: Product) => {
    const nextId = Date.now();
    const { docId, ...record } = product;
    try {
      const docRef = await addDoc(collection(db, "products"), {
        ...record,
        id: nextId,
        createdAt: new Date(),
      });
      return { ...product, id: nextId, docId: docRef.id };
    } catch (err: any) {
      console.warn("Firestore addDoc failed, falling back to localStorage", err);
      // fallback to local storage when permissions prevent writes
      const localProducts = loadLocalProducts();
      const localRecord = { ...record, id: nextId } as Product;
      const localDocId = `local-${nextId}`;
      const toStore = { ...localRecord, docId: localDocId };
      localProducts.push(toStore);
      saveLocalProducts(localProducts);
      // update in-memory products list
      setProducts(prev => [...prev, toStore]);
      return toStore;
    }
  };

  const updateProduct = async (product: Product) => {
    if (!product.docId) return null;
    const { docId, ...record } = product;
    // local update
    if (docId.startsWith && docId.startsWith("local-")) {
      const localProducts = loadLocalProducts();
      const idx = localProducts.findIndex(p => p.docId === docId);
      if (idx >= 0) {
        localProducts[idx] = { ...record, docId } as Product;
        saveLocalProducts(localProducts);
        setProducts(prev => prev.map(p => p.docId === docId ? localProducts[idx] : p));
        return localProducts[idx];
      }
      return null;
    }

    try {
      const docRef = doc(db, "products", docId);
      await updateDoc(docRef, {
        ...record,
        updatedAt: new Date(),
      });
      return { ...product };
    } catch (err: any) {
      console.warn("Firestore updateDoc failed, falling back to localStorage", err);
      // fallback: store as local product
      const localProducts = loadLocalProducts();
      const localDocId = `local-${product.id || Date.now()}`;
      const toStore = { ...record, docId: localDocId } as Product;
      localProducts.push(toStore);
      saveLocalProducts(localProducts);
      setProducts(prev => prev.map(p => p.docId === docId ? toStore : p));
      return toStore;
    }
  };

  const deleteProduct = async (product: Product) => {
    if (!product.docId) return;
    if (product.docId.startsWith && product.docId.startsWith("local-")) {
      const localProducts = loadLocalProducts().filter(p => p.docId !== product.docId);
      saveLocalProducts(localProducts);
      return;
    }
    try {
      await deleteDoc(doc(db, "products", product.docId));
    } catch (err: any) {
      console.warn("Firestore deleteDoc failed, removing local copy if any", err);
      const localProducts = loadLocalProducts().filter(p => p.docId !== product.docId);
      saveLocalProducts(localProducts);
    }
  };

  const updateOrderStatus = async (id: string, s: OrderStatus) => {
    const ord = orders.find(o => o.id === id);
    if (!ord) return;
    // local-only order
    if (ord.docId && ord.docId.startsWith && ord.docId.startsWith("local-")) {
      const local = loadLocalOrders();
      const idx = local.findIndex(o => o.docId === ord.docId);
      if (idx >= 0) {
        local[idx].status = s;
        saveLocalOrders(local);
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: s } : o));
      }
      return;
    }

    try {
      // update Firestore doc if available
      if (ord.docId) {
        await updateDoc(doc(db, "orders", ord.docId), { status: s, updatedAt: new Date() });
      }
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: s } : o));
    } catch (err) {
      console.warn("Failed to update order status in Firestore, falling back to local", err);
      // fallback local
      const local = loadLocalOrders();
      const existing = local.find(o => o.id === id || o.docId === ord.docId);
      if (existing) {
        existing.status = s;
        saveLocalOrders(local);
      } else {
        local.push({ ...ord, status: s, docId: `local-${Date.now()}` });
        saveLocalOrders(local);
      }
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: s } : o));
    }
  };

  const handleDeleteOrder = async (id: string) => {
    const ord = orders.find(o => o.id === id);
    if (!ord) return;
    if (ord.docId && ord.docId.startsWith && ord.docId.startsWith("local-")) {
      const local = loadLocalOrders().filter(o => o.docId !== ord.docId);
      saveLocalOrders(local);
      setOrders(prev => prev.filter(o => o.id !== id));
      showNotif("Order removed");
      return;
    }
    try {
      if (ord.docId) await deleteDoc(doc(db, "orders", ord.docId));
      setOrders(prev => prev.filter(o => o.id !== id));
      showNotif("Order removed");
    } catch (err) {
      console.warn("Failed to delete order in Firestore, removing locally", err);
      const local = loadLocalOrders().filter(o => o.id !== id && o.docId !== ord.docId);
      saveLocalOrders(local);
      setOrders(prev => prev.filter(o => o.id !== id));
      showNotif("Order removed locally");
    }
  };

  const handleDeleteCustomer = async (id: number) => {
    const cust = customers.find(c => c.id === id);
    if (!cust) return;
    if (cust.docId && cust.docId.startsWith && cust.docId.startsWith("local-")) {
      const local = loadLocalCustomers().filter(c => c.docId !== cust.docId);
      saveLocalCustomers(local);
      setCustomers(prev => prev.filter(c => c.id !== id));
      showNotif("Customer removed");
      return;
    }
    try {
      if (cust.docId) await deleteDoc(doc(db, "customers", cust.docId));
      setCustomers(prev => prev.filter(c => c.id !== id));
      showNotif("Customer removed");
    } catch (err) {
      console.warn("Failed to delete customer in Firestore, removing locally", err);
      const local = loadLocalCustomers().filter(c => c.id !== id && c.docId !== cust.docId);
      saveLocalCustomers(local);
      setCustomers(prev => prev.filter(c => c.id !== id));
      showNotif("Customer removed locally");
    }
  };

  // --- localStorage helpers for offline/dev fallback ---
  function loadLocalProducts(): Product[] {
    try {
      const raw = localStorage.getItem("local_products");
      if (!raw) return [];
      return JSON.parse(raw) as Product[];
    } catch (e) {
      console.warn("Failed to parse local_products", e);
      return [];
    }
  }

  function saveLocalProducts(items: Product[]) {
    try {
      localStorage.setItem("local_products", JSON.stringify(items));
    } catch (e) {
      console.warn("Failed to save local_products", e);
    }
  }

  // local storage helpers for orders/customers
  function loadLocalOrders(): Order[] {
    try {
      const raw = localStorage.getItem("local_orders");
      if (!raw) return [];
      return JSON.parse(raw) as Order[];
    } catch (e) {
      console.warn("Failed to parse local_orders", e);
      return [];
    }
  }

  function saveLocalOrders(items: Order[]) {
    try {
      localStorage.setItem("local_orders", JSON.stringify(items));
    } catch (e) {
      console.warn("Failed to save local_orders", e);
    }
  }

  function loadLocalCustomers(): Customer[] {
    try {
      const raw = localStorage.getItem("local_customers");
      if (!raw) return [];
      return JSON.parse(raw) as Customer[];
    } catch (e) {
      console.warn("Failed to parse local_customers", e);
      return [];
    }
  }

  function saveLocalCustomers(items: Customer[]) {
    try {
      localStorage.setItem("local_customers", JSON.stringify(items));
    } catch (e) {
      console.warn("Failed to save local_customers", e);
    }
  }

  const handleSaveProduct = async (product: Product) => {
    if (!user) {
      showNotif("Please sign in as admin before saving products.");
      return;
    }

    try {
      if (editingProduct && editingProduct.docId) {
        await updateProduct({ ...product, docId: editingProduct.docId });
      } else {
        await createProduct(product);
      }
      setEditingProduct(null);
      setShowAddProduct(false);
      showNotif("Product saved");
    } catch (error: any) {
      console.error("Failed to save product", error);
      const msg = error?.code || error?.message || "Failed to save product";
      if (msg.toString().toLowerCase().includes("permission") || msg === "permission-denied") {
        showNotif("Permission denied: check Firestore rules or admin privileges.");
      } else {
        showNotif("Failed to save product");
      }
    }
  };

  const handleDeleteProduct = async (id: number) => {
    const product = products.find(p => p.id === id);
    if (!product) return;
    try {
      if (product.docId) {
        await deleteProduct(product);
      }
      setProducts(prev => prev.filter(x => x.id !== id));
      showNotif("Product deleted");
    } catch (error) {
      console.error("Failed to delete product", error);
      showNotif("Failed to delete product");
    }
  };

  const onLogin = async () => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setView("admin");
      setEmail("");
      setPassword("");
    } catch (error: any) {
      console.error("Login failed", error);
      setAuthError(error?.message || "Unable to sign in");
    }
  };

  const onLogout = async () => {
    try {
      await signOut(auth);
      setView("shop");
      showNotif("Signed out");
    } catch (error) {
      console.error("Sign out failed", error);
      showNotif("Failed to sign out");
    }
  };

  const placeOrder = () => {
    setCart([]);
    setOrderPlaced(true);
    setCheckoutStep(1);
    setTimeout(() => { setOrderPlaced(false); setView("shop"); }, 4000);
  };

  // If the path is /ar/:id render AR view page directly
  const arRouteMatch = location.pathname.match(/^\/ar\/(.+)/);
  if (arRouteMatch) {
    return <ArView product={arProductState} />;
  }

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Notification toast */}
      {notification && (
        <div className="fixed top-5 right-5 z-[100] bg-foreground text-background px-5 py-3 text-sm flex items-center gap-2 shadow-xl animate-[slideIn_0.3s_ease]">
          <Check size={14} className="text-accent" />{notification}
        </div>
      )}

      {arProduct && <ARModal product={arProduct} onClose={() => setArProduct(null)} />}
      {qrProduct && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border p-6 rounded-lg">
            <h3 className="mb-4 font-medium">Scan to view in AR</h3>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(PUBLIC_URL + '/ar/' + qrProduct.id)}`} alt="QR" className="w-64 h-64" />
            <div className="mt-4 flex gap-2">
              <a href={`${PUBLIC_URL}/ar/${qrProduct.id}`} target="_blank" rel="noreferrer" className="px-3 py-2 bg-foreground text-background">Open</a>
              <button onClick={() => { navigator.clipboard?.writeText(`${PUBLIC_URL}/ar/${qrProduct.id}`); }} className="px-3 py-2 border">Copy Link</button>
              <button onClick={() => setQrProduct(null)} className="px-3 py-2 border">Close</button>
            </div>
          </div>
        </div>
      )}

      {cartOpen && (
        <CartSidebar
          cart={cart} cartTotal={cartTotal}
          onClose={() => setCartOpen(false)}
          onUpdateQty={updateCartQty}
          onRemove={(id, c) => setCart(prev => prev.filter(i => !(i.product.id === id && i.color === c)))}
          onCheckout={() => { setCartOpen(false); setView("checkout"); }}
        />
      )}

      {view === "admin" && user && (
        <AdminPanel
          tab={adminTab} setTab={setAdminTab}
          products={products} orders={orders} customers={customers}
          totalRevenue={totalRevenue} pendingOrders={pendingOrders}
          cartCount={cartCount} onBack={() => setView("shop")}
          onDeleteProduct={handleDeleteProduct}
          onUpdateOrderStatus={updateOrderStatus}
          onDeleteOrder={handleDeleteOrder}
          onDeleteCustomer={handleDeleteCustomer}
          editingProduct={editingProduct}
          setEditingProduct={setEditingProduct}
          showAddProduct={showAddProduct}
          setShowAddProduct={setShowAddProduct}
          onSaveProduct={handleSaveProduct}
          onSignOut={onLogout}
          currentUser={user}
          showNotif={showNotif}
          onSyncModels={syncProductModels}
        />
      )}

      {view === "checkout" && (
        <CheckoutPage
          cart={cart} cartTotal={cartTotal}
          step={checkoutStep} setStep={setCheckoutStep}
          onPlaceOrder={placeOrder} orderPlaced={orderPlaced}
          onBack={() => setView("shop")}
        />
      )}

      {view === "login" && (
        <div className="min-h-screen flex items-center justify-center bg-background px-6">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-xl">
            <h2 className="text-2xl font-semibold mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>Admin Sign In</h2>
            <p className="text-sm text-muted-foreground mb-6">Enter your Firebase admin credentials to manage products.</p>
            <div className="space-y-4">
              <label className="block text-xs font-mono text-muted-foreground uppercase mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground transition-colors"
              />
              <label className="block text-xs font-mono text-muted-foreground uppercase mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground transition-colors"
              />
              {authError && <p className="text-sm text-destructive font-mono">{authError}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setView("shop")} className="flex-1 border border-border py-2.5 text-sm hover:border-foreground transition-colors">Back</button>
                <button onClick={onLogin} className="flex-1 bg-foreground text-background py-2.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">Sign In</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {view === "product" && selectedProduct && (
        <ProductDetail
          product={selectedProduct} selectedColor={selectedColor}
          setSelectedColor={setSelectedColor}
          onARView={() => setQrProduct(selectedProduct)}
          onAddToCart={() => addToCart(selectedProduct, selectedColor)}
          onBack={() => setView("shop")}
          cartCount={cartCount} onCartOpen={() => setCartOpen(true)}
        />
      )}

      {view === "shop" && (
        <ShopView
          products={filteredProducts}
          categories={CATEGORIES}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          cartCount={cartCount}
          onCartOpen={() => setCartOpen(true)}
          onProductClick={p => { setSelectedProduct(p); setSelectedColor(p.colors[0]); setView("product"); }}
          onARView={setQrProduct}
          onAddToCart={p => addToCart(p, p.colors[0])}
          loading={loadingProducts}
        />
      )}
    </div>
  );
}
