"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  CheckCircle,
  CreditCard,
  LogIn,
  Package,
  Tag,
  Truck,
} from "lucide-react";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { CouponInput } from "@/components/coupon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ProductImage } from "@/components/ui/ProductImage";
import { api } from "@/lib/api";
import type { Coupon } from "@/lib/coupon";
import { paymentApi } from "@/lib/payment";
import {
  getCategoryPlaceholderImage,
  resolveProductImageSource,
} from "@/lib/product-images";
import {
  useCartStore,
  type Address,
  type CartResponse,
  type Order,
} from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import { buildLoginRedirect, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { useLanguage } from "@/components/providers/language-provider";

type Locale = "vi" | "en";

type AddressFormState = {
  receiverName: string;
  phoneNumber: string;
  province: string;
  district: string;
  ward: string;
  streetAddress: string;
  notes: string;
};

const COPY: Record<
  Locale,
  Record<string, string | string[] | ((value?: string) => string)>
> = {
  vi: {
    loginRequiredTitle: "Đăng nhập để tiếp tục thanh toán",
    loginRequiredDescription:
      "Giỏ hàng của bạn sẽ được giữ lại. Đăng nhập để xác nhận địa chỉ, ưu đãi và hoàn tất đơn hàng an toàn.",
    loginButton: "Đăng nhập thanh toán",
    guestBrowseProducts: "Tiếp tục mua sách",
    emptyTitle: "Giỏ hàng trống",
    emptyDescription: "Vui lòng thêm sản phẩm vào giỏ hàng trước khi đặt hàng.",
    browseProducts: "Khám phá sách",
    loadingCart: "Đang tải giỏ hàng...",
    successTitle: "Đặt hàng thành công!",
    successDescription: "Cảm ơn bạn đã mua sắm tại BookStore.",
    orderNumber: "Mã đơn hàng",
    successInfo: "Thông tin đơn hàng",
    successEmail: (email?: string) =>
      `Đơn hàng đã được lưu cho ${email || "tài khoản của bạn"}.`,
    successOrders: 'Bạn có thể theo dõi đơn hàng trong mục "Đơn hàng của tôi".',
    successETA: "Dự kiến giao hàng: 3-5 ngày làm việc",
    viewOrders: "Xem đơn hàng",
    continueShopping: "Tiếp tục mua sắm",
    shippingInfo: "Thông tin giao hàng",
    savedAddresses: "Địa chỉ đã lưu",
    addNewAddress: "Thêm địa chỉ mới",
    fullName: "Họ tên người nhận *",
    phone: "Số điện thoại *",
    province: "Tỉnh / Thành phố *",
    district: "Quận / Huyện *",
    ward: "Phường / Xã *",
    street: "Địa chỉ cụ thể *",
    notes: "Ghi chú",
    shippingMethod: "Phương thức vận chuyển",
    nextPayment: "Tiếp tục thanh toán",
    paymentMethod: "Phương thức thanh toán",
    paymentHint: "Portfolio runtime chỉ giữ các phương thức đã có flow thật.",
    vnpayUnavailable:
      "VNPay sẽ khả dụng khi merchant config đã được thiết lập.",
    back: "Quay lại",
    confirmInfo: "Xác nhận thông tin",
    confirmOrder: "Xác nhận đơn hàng",
    shippingSummary: "Địa chỉ giao hàng",
    paymentSummary: "Phương thức thanh toán",
    orderItems: "Sản phẩm đặt hàng",
    orderSummary: "Tổng quan đơn hàng",
    subtotal: "Tạm tính",
    shipping: "Phí vận chuyển",
    freeShipping: "Miễn phí",
    tax: "Thuế (VAT 10%)",
    total: "Tổng cộng",
    orderNow: "Đặt hàng ngay",
    processing: "Đang xử lý...",
    orderError: "Đã xảy ra lỗi khi đặt hàng. Vui lòng thử lại.",
    addressError: "Vui lòng điền đầy đủ thông tin giao hàng.",
    savedAddressError: "Vui lòng chọn một địa chỉ đã lưu.",
    couponCode: "Mã",
    defaultAddress: "Mặc định",
    cod: "Thanh toán khi nhận hàng (COD)",
    vnPay: "VNPay",
    standardShipping: "Giao hàng tiêu chuẩn",
    expressShipping: "Giao hàng nhanh",
    standardDesc: "3-5 ngày",
    expressDesc: "1-2 ngày",
    vnpayRedirecting: "Đang chuyển sang cổng thanh toán VNPay...",
    vnpayFallback:
      "Đơn hàng đã được tạo nhưng chưa thể khởi tạo VNPay. Vui lòng thử lại từ trang đơn hàng.",
    steps: ["Thông tin giao hàng", "Thanh toán", "Xác nhận"],
  },
  en: {
    loginRequiredTitle: "Sign in to continue checkout",
    loginRequiredDescription:
      "Your cart will stay ready. Sign in to confirm shipping, apply offers, and place the order securely.",
    loginButton: "Sign in to checkout",
    guestBrowseProducts: "Keep browsing books",
    emptyTitle: "Your cart is empty",
    emptyDescription: "Please add items to your cart before placing an order.",
    browseProducts: "Browse books",
    loadingCart: "Loading your cart...",
    successTitle: "Order placed successfully!",
    successDescription: "Thank you for shopping at BookStore.",
    orderNumber: "Order number",
    successInfo: "Order information",
    successEmail: (email?: string) =>
      `Your order has been saved for ${email || "your account"}.`,
    successOrders: 'You can track this order in "My Orders".',
    successETA: "Estimated delivery: 3-5 business days",
    viewOrders: "View orders",
    continueShopping: "Continue shopping",
    shippingInfo: "Shipping information",
    savedAddresses: "Saved addresses",
    addNewAddress: "Add new address",
    fullName: "Receiver full name *",
    phone: "Phone number *",
    province: "Province / City *",
    district: "District *",
    ward: "Ward *",
    street: "Street address *",
    notes: "Notes",
    shippingMethod: "Shipping method",
    nextPayment: "Continue to payment",
    paymentMethod: "Payment method",
    paymentHint:
      "The portfolio runtime only keeps payment methods with a real flow.",
    vnpayUnavailable:
      "VNPay will appear once merchant configuration is available.",
    back: "Back",
    confirmInfo: "Confirm information",
    confirmOrder: "Confirm order",
    shippingSummary: "Shipping address",
    paymentSummary: "Payment method",
    orderItems: "Order items",
    orderSummary: "Order summary",
    subtotal: "Subtotal",
    shipping: "Shipping fee",
    freeShipping: "Free",
    tax: "Tax (VAT 10%)",
    total: "Total",
    orderNow: "Place order",
    processing: "Processing...",
    orderError:
      "Something went wrong while placing an order. Please try again.",
    addressError: "Please complete all shipping information.",
    savedAddressError: "Please choose one of your saved addresses.",
    couponCode: "Code",
    defaultAddress: "Default",
    cod: "Cash on delivery (COD)",
    vnPay: "VNPay",
    standardShipping: "Standard shipping",
    expressShipping: "Express shipping",
    standardDesc: "3-5 days",
    expressDesc: "1-2 days",
    vnpayRedirecting: "Redirecting to VNPay...",
    vnpayFallback:
      "The order was created but VNPay could not be started. Please retry from the order page.",
    steps: ["Shipping information", "Payment", "Confirmation"],
  },
};

const SHIPPING_METHODS = [
  { id: "STANDARD", price: 25000, free: false },
  { id: "EXPRESS", price: 40000, free: true },
] as const;

const isVNPayEnabled = () => process.env.NEXT_PUBLIC_VNPAY_ENABLED === "true";

function buildFullAddress(form: AddressFormState) {
  return [
    form.streetAddress.trim(),
    form.ward.trim(),
    form.district.trim(),
    form.province.trim(),
  ]
    .filter(Boolean)
    .join(", ");
}

export default function CheckoutPage() {
  const { locale } = useLanguage();
  const copy = COPY[locale];
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth(true);
  const { items, clearCart, setCart } = useCartStore();
  const [step, setStep] = useState(1);
  const [shippingMethod, setShippingMethod] = useState("STANDARD");
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "VNPAY">("COD");
  const [useNewAddress, setUseNewAddress] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(
    null,
  );
  const [orderSuccess, setOrderSuccess] = useState<Order | null>(null);
  const [orderErrorMessage, setOrderErrorMessage] = useState<string | null>(
    null,
  );
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [addressForm, setAddressForm] = useState<AddressFormState>({
    receiverName: user?.fullName || "",
    phoneNumber: user?.phoneNumber || "",
    province: "",
    district: "",
    ward: "",
    streetAddress: "",
    notes: "",
  });

  const vnPayEnabled = isVNPayEnabled();

  const { data: addresses = [] } = useQuery({
    queryKey: ["addresses"],
    queryFn: async () => (await api.get("/addresses")).data as Address[],
    enabled: isAuthenticated,
  });

  const { data: cartData, isLoading: isCartLoading } = useQuery({
    queryKey: ["cart"],
    queryFn: async () => (await api.get("/cart")).data as CartResponse,
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (addresses.length > 0 && selectedAddressId == null) {
      setSelectedAddressId(
        (addresses.find((address) => address.isDefault) ?? addresses[0]).id,
      );
    }
  }, [addresses, selectedAddressId]);

  useEffect(() => {
    if (cartData) {
      setCart(cartData.items, cartData.totalItems, cartData.total);
    }
  }, [cartData, setCart]);

  const selectedSavedAddress = useMemo(
    () => addresses.find((address) => address.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId],
  );
  const selectedShipping =
    SHIPPING_METHODS.find((method) => method.id === shippingMethod) ??
    SHIPPING_METHODS[0];
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const shippingFee =
    subtotal >= 200000 || selectedShipping.free ? 0 : selectedShipping.price;
  const estimatedTax = Math.max(
    0,
    Math.round((subtotal - discountAmount) * 0.1),
  );
  const grandTotal = subtotal + shippingFee + estimatedTax - discountAmount;
  const isNewAddressComplete = [
    addressForm.receiverName,
    addressForm.phoneNumber,
    addressForm.province,
    addressForm.district,
    addressForm.ward,
    addressForm.streetAddress,
  ].every((value) => value.trim().length > 0);

  const checkoutAddress = useMemo(() => {
    if (useNewAddress) {
      if (!isNewAddressComplete) return null;
      return {
        receiverName: addressForm.receiverName.trim(),
        phoneNumber: addressForm.phoneNumber.trim(),
        fullAddress: buildFullAddress(addressForm),
        notes: addressForm.notes.trim(),
      };
    }
    if (!selectedSavedAddress) return null;
    return {
      receiverName: selectedSavedAddress.receiverName,
      phoneNumber: selectedSavedAddress.phoneNumber,
      fullAddress: selectedSavedAddress.fullAddress,
      notes: addressForm.notes.trim(),
    };
  }, [addressForm, isNewAddressComplete, selectedSavedAddress, useNewAddress]);

  const createOrderMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      (await api.post("/orders", payload)).data as Order,
  });

  const t = (key: string) => copy[key] as string;
  const stepLabels = copy.steps as string[];

  function validateAddressStep() {
    if (useNewAddress && !isNewAddressComplete) {
      toast.error(t("addressError"));
      return false;
    }
    if (!useNewAddress && !selectedSavedAddress) {
      toast.error(t("savedAddressError"));
      return false;
    }
    return true;
  }

  async function handleSubmitOrder() {
    if (!checkoutAddress) {
      const message = useNewAddress
        ? t("addressError")
        : t("savedAddressError");
      setOrderErrorMessage(message);
      toast.error(message);
      return;
    }

    try {
      setOrderErrorMessage(null);
      const order = await createOrderMutation.mutateAsync({
        items: items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
        shippingAddress: checkoutAddress.fullAddress,
        shippingPhone: checkoutAddress.phoneNumber,
        shippingReceiverName: checkoutAddress.receiverName,
        shippingMethod:
          shippingMethod === "EXPRESS"
            ? t("expressShipping")
            : t("standardShipping"),
        paymentMethod,
        notes: checkoutAddress.notes || undefined,
        couponCode: appliedCoupon?.code,
      });

      clearCart();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cart"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
      ]);

      if (paymentMethod === "VNPAY") {
        const payment = await paymentApi.createVNPayPayment(order.id);
        if (payment.paymentUrl) {
          toast.success(t("vnpayRedirecting"));
          window.location.assign(payment.paymentUrl);
          return;
        }
        toast.error(t("vnpayFallback"));
        router.push(`/orders/${order.id}`);
        return;
      }

      setOrderSuccess(order);
      setStep(4);
    } catch (error) {
      const message = isAxiosError(error)
        ? (
            error.response?.data as
              | { message?: string; error?: string }
              | undefined
          )?.message ||
          (
            error.response?.data as
              | { message?: string; error?: string }
              | undefined
          )?.error ||
          t("orderError")
        : error instanceof Error
          ? error.message
          : t("orderError");
      setOrderErrorMessage(message);
      toast.error(message);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50">
        <Header />
        <main className="flex-1 px-4 py-16">
          <section className="mx-auto flex max-w-2xl flex-col items-center rounded-2xl border border-gray-100 bg-white px-6 py-12 text-center shadow-sm sm:px-10">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
              <LogIn className="h-7 w-7" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-gray-950 sm:text-3xl">
              {t("loginRequiredTitle")}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-gray-600">
              {t("loginRequiredDescription")}
            </p>
            <div className="mt-8 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
              <Button
                onClick={() => router.push(buildLoginRedirect("/checkout"))}
                className="bg-red-600 px-6 hover:bg-red-700"
              >
                {t("loginButton")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/products")}
                className="px-6"
              >
                {t("guestBrowseProducts")}
              </Button>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  if (isCartLoading && items.length === 0 && !orderSuccess) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            {t("loadingCart")}
          </h1>
        </main>
        <Footer />
      </div>
    );
  }

  if (items.length === 0 && !orderSuccess) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-16 text-center">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">
            {t("emptyTitle")}
          </h1>
          <p className="mb-8 text-gray-600">{t("emptyDescription")}</p>
          <Button onClick={() => router.push("/products")}>
            {t("browseProducts")}
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  if (orderSuccess) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="mb-4 text-3xl font-bold text-gray-900">
              {t("successTitle")}
            </h1>
            <p className="mb-2 text-gray-600">{t("successDescription")}</p>
            <p className="mb-8 text-lg font-semibold text-primary">
              {t("orderNumber")}: {orderSuccess.orderNumber}
            </p>
            <div className="mb-8 rounded-lg bg-white p-6 text-left shadow-sm">
              <h3 className="mb-4 font-semibold">{t("successInfo")}</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p>
                  {(copy.successEmail as (value?: string) => string)(
                    user?.email,
                  )}
                </p>
                <p>{t("successOrders")}</p>
                <p>{t("successETA")}</p>
              </div>
            </div>
            <div className="flex justify-center gap-4">
              <Button onClick={() => router.push("/orders")} variant="outline">
                {t("viewOrders")}
              </Button>
              <Button onClick={() => router.push("/products")}>
                {t("continueShopping")}
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-center">
          {stepLabels.map((label, index) => (
            <div key={label} className="flex items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${step >= index + 1 ? "bg-primary text-white" : "bg-gray-200 text-gray-500"}`}
              >
                {step > index + 1 ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={`ml-2 font-medium ${step >= index + 1 ? "text-gray-900" : "text-gray-400"}`}
              >
                {label}
              </span>
              {index < stepLabels.length - 1 ? (
                <div className="mx-4 h-0.5 w-16 bg-gray-200" />
              ) : null}
            </div>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {step === 1 ? (
              <div className="rounded-lg bg-white p-6 shadow-sm">
                <h2 className="mb-6 flex items-center text-xl font-bold text-gray-900">
                  <Truck className="mr-2 h-5 w-5 text-primary" />
                  {t("shippingInfo")}
                </h2>
                {addresses.length > 0 ? (
                  <div className="mb-6">
                    <Label className="mb-2 block">{t("savedAddresses")}</Label>
                    <div className="space-y-2">
                      {addresses.map((address) => {
                        const isSelected =
                          !useNewAddress && selectedAddressId === address.id;
                        return (
                          <label
                            key={address.id}
                            className={`flex cursor-pointer items-start rounded-lg border p-4 transition-colors ${isSelected ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"}`}
                          >
                            <input
                              type="radio"
                              name="address"
                              checked={isSelected}
                              onChange={() => {
                                setUseNewAddress(false);
                                setSelectedAddressId(address.id);
                              }}
                              className="mr-3 mt-1"
                            />
                            <div className="flex-1">
                              <p className="font-medium">
                                {address.receiverName}
                              </p>
                              <p className="text-sm text-gray-600">
                                {address.phoneNumber}
                              </p>
                              <p className="text-sm text-gray-500">
                                {address.fullAddress}
                              </p>
                              {address.isDefault ? (
                                <span className="mt-1 inline-block rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                                  {t("defaultAddress")}
                                </span>
                              ) : null}
                            </div>
                          </label>
                        );
                      })}
                      <label
                        className={`flex cursor-pointer items-center rounded-lg border p-4 transition-colors ${useNewAddress ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"}`}
                      >
                        <input
                          type="radio"
                          name="address"
                          checked={useNewAddress}
                          onChange={() => setUseNewAddress(true)}
                          className="mr-3"
                        />
                        <span className="font-medium">
                          {t("addNewAddress")}
                        </span>
                      </label>
                    </div>
                  </div>
                ) : null}
                {useNewAddress ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="receiverName">{t("fullName")}</Label>
                        <Input
                          id="receiverName"
                          value={addressForm.receiverName}
                          onChange={(event) =>
                            setAddressForm((current) => ({
                              ...current,
                              receiverName: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="phoneNumber">{t("phone")}</Label>
                        <Input
                          id="phoneNumber"
                          value={addressForm.phoneNumber}
                          onChange={(event) =>
                            setAddressForm((current) => ({
                              ...current,
                              phoneNumber: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div>
                        <Label htmlFor="province">{t("province")}</Label>
                        <Input
                          id="province"
                          value={addressForm.province}
                          onChange={(event) =>
                            setAddressForm((current) => ({
                              ...current,
                              province: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="district">{t("district")}</Label>
                        <Input
                          id="district"
                          value={addressForm.district}
                          onChange={(event) =>
                            setAddressForm((current) => ({
                              ...current,
                              district: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="ward">{t("ward")}</Label>
                        <Input
                          id="ward"
                          value={addressForm.ward}
                          onChange={(event) =>
                            setAddressForm((current) => ({
                              ...current,
                              ward: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="streetAddress">{t("street")}</Label>
                      <Input
                        id="streetAddress"
                        value={addressForm.streetAddress}
                        onChange={(event) =>
                          setAddressForm((current) => ({
                            ...current,
                            streetAddress: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                ) : null}
                <div className="mt-4">
                  <Label htmlFor="notes">{t("notes")}</Label>
                  <Input
                    id="notes"
                    value={addressForm.notes}
                    onChange={(event) =>
                      setAddressForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="mt-6">
                  <Label className="mb-3 block">{t("shippingMethod")}</Label>
                  <div className="space-y-2">
                    {SHIPPING_METHODS.map((method) => {
                      const selected = shippingMethod === method.id;
                      const title =
                        method.id === "EXPRESS"
                          ? t("expressShipping")
                          : t("standardShipping");
                      const desc =
                        method.id === "EXPRESS"
                          ? t("expressDesc")
                          : t("standardDesc");
                      return (
                        <label
                          key={method.id}
                          className={`flex items-center justify-between rounded-lg border p-4 transition-colors ${selected ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"}`}
                        >
                          <div className="flex items-center">
                            <input
                              type="radio"
                              name="shipping"
                              value={method.id}
                              checked={selected}
                              onChange={() => setShippingMethod(method.id)}
                              className="mr-3"
                            />
                            <div>
                              <p className="font-medium">{title}</p>
                              <p className="text-sm text-gray-500">{desc}</p>
                            </div>
                          </div>
                          <span className="font-semibold text-primary">
                            {method.free || subtotal >= 200000
                              ? t("freeShipping")
                              : formatCurrency(method.price)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <Button
                  className="mt-6 w-full"
                  size="lg"
                  onClick={() => {
                    if (!validateAddressStep()) return;
                    setStep(2);
                  }}
                  disabled={
                    useNewAddress
                      ? !isNewAddressComplete
                      : !selectedSavedAddress
                  }
                >
                  {t("nextPayment")}
                </Button>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="rounded-lg bg-white p-6 shadow-sm">
                <h2 className="mb-6 flex items-center text-xl font-bold text-gray-900">
                  <CreditCard className="mr-2 h-5 w-5 text-primary" />
                  {t("paymentMethod")}
                </h2>
                <p className="mb-4 text-sm text-gray-500">{t("paymentHint")}</p>
                <div className="space-y-3">
                  {[
                    {
                      id: "COD" as const,
                      title: t("cod"),
                      icon: Package,
                      disabled: false,
                      description:
                        locale === "vi"
                          ? "Thanh toán sau khi nhận hàng"
                          : "Pay after delivery",
                    },
                    {
                      id: "VNPAY" as const,
                      title: t("vnPay"),
                      icon: Building2,
                      disabled: !vnPayEnabled,
                      description: vnPayEnabled
                        ? locale === "vi"
                          ? "Chuyển sang cổng thanh toán VNPay"
                          : "Redirect to the VNPay gateway"
                        : t("vnpayUnavailable"),
                    },
                  ].map((method) => (
                    <label
                      key={method.id}
                      className={`flex items-center rounded-lg border p-4 transition-colors ${paymentMethod === method.id && !method.disabled ? "border-primary bg-primary/5" : "border-gray-200"} ${method.disabled ? "cursor-not-allowed opacity-60" : "hover:border-gray-300"}`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        value={method.id}
                        checked={paymentMethod === method.id}
                        onChange={() => {
                          if (!method.disabled) setPaymentMethod(method.id);
                        }}
                        className="mr-4"
                        disabled={method.disabled}
                      />
                      <method.icon className="mr-3 h-5 w-5 text-gray-600" />
                      <div>
                        <span className="font-medium">{method.title}</span>
                        <p className="text-sm text-gray-500">
                          {method.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="mt-6 flex gap-4">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t("back")}
                  </Button>
                  <Button onClick={() => setStep(3)} className="flex-1">
                    {t("confirmInfo")}
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="rounded-lg bg-white p-6 shadow-sm">
                <h2 className="mb-6 text-xl font-bold text-gray-900">
                  {t("confirmOrder")}
                </h2>
                <div className="space-y-6">
                  <div>
                    <h3 className="mb-2 font-semibold">
                      {t("shippingSummary")}
                    </h3>
                    <p className="text-gray-600">
                      {checkoutAddress?.receiverName} -{" "}
                      {checkoutAddress?.phoneNumber}
                    </p>
                    <p className="text-gray-600">
                      {checkoutAddress?.fullAddress}
                    </p>
                    {checkoutAddress?.notes ? (
                      <p className="mt-1 text-sm text-gray-500">
                        {t("notes")}: {checkoutAddress.notes}
                      </p>
                    ) : null}
                  </div>
                  <Separator />
                  <div>
                    <h3 className="mb-2 font-semibold">
                      {t("shippingMethod")}
                    </h3>
                    <p className="text-gray-600">
                      {shippingMethod === "EXPRESS"
                        ? `${t("expressShipping")} (${t("expressDesc")})`
                        : `${t("standardShipping")} (${t("standardDesc")})`}
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <h3 className="mb-2 font-semibold">
                      {t("paymentSummary")}
                    </h3>
                    <p className="text-gray-600">
                      {paymentMethod === "VNPAY" ? t("vnPay") : t("cod")}
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <h3 className="mb-3 font-semibold">{t("orderItems")}</h3>
                    <div className="space-y-3">
                      {items.map((item) => (
                        <div key={item.id} className="flex items-center gap-4">
                          <div className="relative h-20 w-16 flex-shrink-0 overflow-hidden rounded bg-gray-100">
                            <ProductImage
                              src={resolveProductImageSource(item.product)}
                              fallbackSrc={getCategoryPlaceholderImage(
                                item.product.category?.name,
                              )}
                              alt={item.product.name}
                              fill
                              sizes="64px"
                              className="object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 text-sm font-medium">
                              {item.product.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              x{item.quantity}
                            </p>
                          </div>
                          <p className="text-sm font-semibold">
                            {formatCurrency(item.subtotal)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex gap-4">
                  <Button
                    variant="outline"
                    onClick={() => setStep(2)}
                    className="flex-1"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t("back")}
                  </Button>
                  <Button
                    onClick={() => {
                      void handleSubmitOrder();
                    }}
                    className="flex-1"
                    size="lg"
                    disabled={createOrderMutation.isPending || !checkoutAddress}
                  >
                    {createOrderMutation.isPending
                      ? t("processing")
                      : t("orderNow")}
                  </Button>
                </div>
                {orderErrorMessage ? (
                  <p className="mt-4 text-center text-sm text-red-500">
                    {orderErrorMessage}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-lg bg-white p-6 shadow-sm">
              <h2 className="mb-6 text-xl font-bold text-gray-900">
                {t("orderSummary")}
              </h2>
              <div className="mb-6 space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="relative h-16 w-12 flex-shrink-0 overflow-hidden rounded bg-gray-100">
                      <ProductImage
                        src={resolveProductImageSource(item.product)}
                        fallbackSrc={getCategoryPlaceholderImage(
                          item.product.category?.name,
                        )}
                        alt={item.product.name}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-medium">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-gray-500">x{item.quantity}</p>
                    </div>
                    <p className="text-sm font-semibold">
                      {formatCurrency(item.subtotal)}
                    </p>
                  </div>
                ))}
              </div>
              <Separator className="my-4" />
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t("subtotal")}</span>
                  <span className="font-medium">
                    {formatCurrency(subtotal)}
                  </span>
                </div>
                {appliedCoupon ? (
                  <div className="flex justify-between text-green-600">
                    <span className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {t("couponCode")} {appliedCoupon.code}
                    </span>
                    <span className="font-medium">
                      -{formatCurrency(discountAmount)}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span className="text-gray-600">{t("shipping")}</span>
                  <span className="font-medium text-green-600">
                    {shippingFee === 0
                      ? t("freeShipping")
                      : formatCurrency(shippingFee)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t("tax")}</span>
                  <span className="font-medium">
                    {formatCurrency(estimatedTax)}
                  </span>
                </div>
              </div>
              <Separator className="my-4" />
              <div className="mb-4">
                <CouponInput
                  orderTotal={subtotal}
                  onApply={(coupon, discount) => {
                    setAppliedCoupon(coupon);
                    setDiscountAmount(discount);
                  }}
                />
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>{t("total")}</span>
                <span className="text-primary">
                  {formatCurrency(grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
