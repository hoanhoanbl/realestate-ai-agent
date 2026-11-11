import AddCustomerForm from "@/components/AddCustomerForm";
import { BackLink, PageHeader } from "@/components/ui";

// Nhân viên thêm khách ngoài hệ thống (hotline, biển treo, đến văn phòng, Zalo cá nhân, giới thiệu)
export default function AddCustomerPage() {
  return (
    <section className="max-w-3xl">
      <BackLink href="/admin/leads">Danh sách khách</BackLink>
      <div className="mt-2">
        <PageHeader title="Thêm khách" description="Nhập khách đến từ ngoài web và bot để có người phụ trách và nằm trong báo cáo." />
      </div>
      <div className="mt-5">
        <AddCustomerForm />
      </div>
    </section>
  );
}
