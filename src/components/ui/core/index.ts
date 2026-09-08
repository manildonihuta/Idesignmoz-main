"use client";

/* Reusable design-system primitives (the "core kit"). */

export { cx } from "./primitives";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDesc,
  Button,
  buttonVariants,
  Spinner,
  StatusBadge,
  Pill,
  IconTile,
  type ButtonProps,
  type ButtonVariants,
  type StatusTone,
} from "./primitives";

export {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonGrid,
  useProgressive,
  useOptimisticAction,
  LoadingIndicator,
} from "./loading";

export { EmptyState, Empty, type EmptyStateProps } from "./empty-state";

export { Modal, type ModalProps } from "./modal";
export { Drawer, type DrawerProps } from "./drawer";
export {
  ToastProvider,
  useToast,
  type ToastItem,
  type ToastTone,
  type Notify,
} from "./toast";

export { Navbar, MobileMenu, type NavbarProps, type NavItem, type MobileMenuProps } from "./navbar";
export { Footer, type FooterProps, type FooterColumn } from "./footer";
export { Hero, type HeroProps } from "./hero";
export { Section, type SectionProps } from "./section";
export { DashboardCard, dashboardCardVariants, type DashboardCardProps } from "./dashboard-card";

export {
  ServiceCard,
  PricingCard,
  TestimonialCard,
  PortfolioCard,
  HostingCard,
  SpecRow,
  DomainCard,
  type ServiceCardProps,
  type PricingCardProps,
  type TestimonialCardProps,
  type PortfolioCardProps,
  type HostingCardProps,
  type SpecRowProps,
  type DomainCardProps,
} from "./cards";

export { Faq, Cta, type FaqProps, type FaqItem, type CtaProps } from "./faq-cta";

export {
  SearchBar,
  TextField,
  SelectField,
  TextareaField,
  Form,
  FormRow,
  inputVariants,
  type SearchBarProps,
  type TextFieldProps,
  type SelectFieldProps,
  type TextareaFieldProps,
} from "./forms";

export {
  CategoryTabs,
  FilterBar,
  type CategoryTabsProps,
  type FilterBarProps,
  type FilterOption,
} from "./filter-bar";

export {
  Table,
  DataTable,
  type TableProps,
  type DataTableProps,
  type Column,
} from "./table";

export { Stepper, type StepperProps, type Step } from "./stepper";