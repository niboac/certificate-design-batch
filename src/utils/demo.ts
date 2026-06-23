import type { ExcelData } from "@/types";

// 生成 demo 示例数据：10 条包含姓名、年龄、性别、证书编号、照片地址的记录
export function createDemoData(): ExcelData {
  const columns = ["姓名", "年龄", "性别", "证书编号", "照片地址"];
  const rows: Record<string, string>[] = [
    { 姓名: "张伟", 年龄: "28", 性别: "男", 证书编号: "CERT-2026-0001", 照片地址: "https://i.pravatar.cc/300?img=11" },
    { 姓名: "王芳", 年龄: "32", 性别: "女", 证书编号: "CERT-2026-0002", 照片地址: "https://i.pravatar.cc/300?img=12" },
    { 姓名: "李娜", 年龄: "25", 性别: "女", 证书编号: "CERT-2026-0003", 照片地址: "https://i.pravatar.cc/300?img=13" },
    { 姓名: "刘强", 年龄: "35", 性别: "男", 证书编号: "CERT-2026-0004", 照片地址: "https://i.pravatar.cc/300?img=14" },
    { 姓名: "陈静", 年龄: "29", 性别: "女", 证书编号: "CERT-2026-0005", 照片地址: "https://i.pravatar.cc/300?img=15" },
    { 姓名: "杨洋", 年龄: "27", 性别: "男", 证书编号: "CERT-2026-0006", 照片地址: "https://i.pravatar.cc/300?img=16" },
    { 姓名: "赵敏", 年龄: "31", 性别: "女", 证书编号: "CERT-2026-0007", 照片地址: "https://i.pravatar.cc/300?img=17" },
    { 姓名: "孙磊", 年龄: "26", 性别: "男", 证书编号: "CERT-2026-0008", 照片地址: "https://i.pravatar.cc/300?img=18" },
    { 姓名: "周婷", 年龄: "33", 性别: "女", 证书编号: "CERT-2026-0009", 照片地址: "https://i.pravatar.cc/300?img=19" },
    { 姓名: "吴昊", 年龄: "30", 性别: "男", 证书编号: "CERT-2026-0010", 照片地址: "https://i.pravatar.cc/300?img=20" },
  ];
  return {
    columns,
    rows,
    fileName: "示例数据.xlsx",
  };
}
