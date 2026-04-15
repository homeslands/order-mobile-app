// import {
//   Select,
// } from "@/components/ui";
// import { useEffect, useState } from "react";

// import { IProductVariant } from "@/types";
// import { useTranslation } from "react-i18next";

// interface SelectProductVariantProps {
//   defaultValue?: string;
//   variant: IProductVariant[]
//   onChange: (value: string) => void;
// }

// export default function ProductVariantSelect({ variant, defaultValue, onChange }: SelectProductVariantProps) {
//   const [, setAllVariants] = useState<{ value: string; label: string }[]>([])
//   const { t } = useTranslation(['product'])

//   useEffect(() => {
//     const newVariants = variant.map((item) => ({
//       value: item.slug || '',
//       label: (item.size.name?.[0]?.toUpperCase() + item.size.name?.slice(1)) || '',
//     }));
//     setAllVariants(newVariants)
//   }, [variant]);
//   return (
//     <Select onValueChange={onChange} defaultValue={defaultValue} value={variant[0].slug}>
//       <Select.Trigger className="text-xs w-fit min-w-24 dark:border-muted-foreground/60">
//         <Select.Value placeholder={t('product.selectProductVariant')} />
//       </Select.Trigger>
//       <Select.Content>
//         <Select.Group>
//           {variant.map((item) => (
//             <Select.Item key={item.slug} value={item.slug}>
//               Size {item.size.name.toUpperCase()}
//             </Select.Item>
//           ))}
//         </Select.Group>
//       </Select.Content>
//     </Select>
//   );
// }
