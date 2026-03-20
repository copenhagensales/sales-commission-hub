import { MainLayout } from "@/components/layout/MainLayout";
import { CustomerInquiryInbox } from "@/components/home/CustomerInquiryInbox";

const CustomerInquiries = () => {
  return (
    <MainLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Kundehenvendelser</h1>
        <CustomerInquiryInbox />
      </div>
    </MainLayout>
  );
};

export default CustomerInquiries;
