'use client';

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Package, Plus, Edit2, Trash2, X, Image as ImageIcon, UploadCloud, Download, FileSpreadsheet, AlertCircle, CheckCircle, Loader2, PowerOff } from 'lucide-react';
import * as XLSX from 'xlsx';

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category_id: string | null;
  is_active?: boolean;
  is_track_stock?: boolean;
};

export default function SuperAdminProductsPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Master Data State
  const [categories, setCategories] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSuccessCount, setImportSuccessCount] = useState<number>(0);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    image_url: '',
    category_id: '',
    is_track_stock: true,
  });

  useEffect(() => {
    fetchProducts();
    fetchMasterData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMasterData = async () => {
    // ดึงหมวดหมู่ และ สาขามาเก็บไว้สำหรับการ Map ข้อมูลตอน Bulk Upload
    const { data: catData } = await supabase.from('categories').select('id, name, parent_id').order('sort_order', { ascending: true });
    if (catData) setCategories(catData);
    const { data: branchData } = await supabase.from('branches').select('id');
    if (branchData) setBranches(branchData);
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      console.error('Error fetching products:', error.message);
      alert('ไม่สามารถดึงข้อมูลสินค้าได้');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingId(product.id);
      setFormData({
        name: product.name || '',
        description: product.description || '',
        price: product.price ? String(product.price) : '',
        image_url: product.image_url || '',
        category_id: product.category_id || '',
        is_track_stock: product.is_track_stock !== false,
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', description: '', price: '', image_url: '', category_id: '', is_track_stock: true });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  // ฟังก์ชันสำหรับอัปโหลดรูปภาพขึ้น Supabase Storage
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      // สุ่มชื่อไฟล์ใหม่เพื่อป้องกันชื่อซ้ำกัน
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // อัปโหลดไปยัง Bucket ชื่อ 'products'
      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // ดึง Public URL ของไฟล์ที่เพิ่งอัปโหลด
      const { data: { publicUrl } } = supabase.storage
        .from('products')
        .getPublicUrl(filePath);

      setFormData({ ...formData, image_url: publicUrl });
    } catch (error: any) {
      console.error('Upload error:', error.message);
      alert(`เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ: ${error.message}`);
    } finally {
      setIsUploadingImage(false);
    }
  };

  // ฟังก์ชันสำหรับลบไฟล์รูปภาพออกจาก Supabase Storage
  const deleteImageFromStorage = async (imageUrl: string | null) => {
    if (!imageUrl) return;
    try {
      // ตัดเอาเฉพาะชื่อไฟล์ที่ต่อท้าย /public/products/ ออกมา
      const urlParts = imageUrl.split('/public/products/');
      if (urlParts.length === 2) {
        const filePath = urlParts[1];
        const { error } = await supabase.storage.from('products').remove([filePath]);
        if (error) console.error('Error removing image from storage:', error.message);
      }
    } catch (err) {
      console.error('Error parsing image URL:', err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        image_url: formData.image_url,
        category_id: formData.category_id || null,
        is_track_stock: formData.is_track_stock,
      };

      if (editingId) {
        // Update Existing Product
        const existingProduct = products.find(p => p.id === editingId);

        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;

        // หากมีการเปลี่ยนรูปภาพ (URL ไม่ตรงกับของเดิม) ให้ลบรูปเก่าออกจาก Storage ทิ้ง
        if (existingProduct?.image_url && existingProduct.image_url !== payload.image_url) {
          await deleteImageFromStorage(existingProduct.image_url);
        }

        alert('อัปเดตข้อมูลสินค้าสำเร็จ');
      } else {
        // Insert New Product
        const { data: newProduct, error } = await supabase
          .from('products')
          .insert([payload])
          .select('id')
          .single();
          
        if (error) throw error;
        
        // ดึงรายชื่อสาขาทั้งหมดเพื่อเพิ่มสินค้านี้ลงไปในสต็อกตั้งต้น
        const { data: branches } = await supabase.from('branches').select('id');
        
        if (branches && branches.length > 0 && newProduct) {
          const inventoryPayload = branches.map((b) => ({
            branch_id: b.id,
            product_id: newProduct.id,
            stock_count: 0,
            status: 0 // 0 = Inactive ปิดการขายไว้เป็นค่าเริ่มต้น ให้แอดมินสาขามาเปิดเอง
          }));
          
          await supabase.from('branch_inventory').insert(inventoryPayload);
        }

        alert('เพิ่มสินค้าใหม่และอัปเดตรายชื่อไปยังทุกสาขาสำเร็จ');
      }

      closeModal();
      fetchProducts();
    } catch (error: any) {
      console.error('Error saving product:', error.message);
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ฟังก์ชันสำหรับระงับการขายสินค้านี้ในทุกสาขาทันที
  const handleDisableGlobally = async (id: string, name: string) => {
    if (!window.confirm(`ยืนยันการ "ระงับการขาย" สินค้า "${name}" ในทุกสาขาใช่หรือไม่?\nสถานะสินค้าในทุกสาขาจะถูกเปลี่ยนเป็นปิดการขายทันที`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('branch_inventory')
        .update({ status: 0 })
        .eq('product_id', id);
        
      if (error) throw error;
      
      alert(`ระงับการขายสินค้า "${name}" ในทุกสาขาเรียบร้อยแล้ว`);
    } catch (error: any) {
      console.error('Error disabling product globally:', error.message);
      alert('ไม่สามารถอัปเดตสถานะในสาขาได้: ' + error.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบสินค้า "${name}" ?\nข้อมูลสต็อกที่ผูกกับสาขาต่างๆ จะถูกลบทิ้งทั้งหมด`)) {
      return;
    }

    try {
      const productToDelete = products.find(p => p.id === id);

      // 1. ลบจากสต็อกของทุกสาขาก่อนเพื่อป้องกัน Foreign Key Constraint Error
      const { error: invError } = await supabase
        .from('branch_inventory')
        .delete()
        .eq('product_id', id);
      if (invError) throw invError;

      // 2. ซ่อนสินค้า (Soft Delete) แทนการลบออกจากตาราง products หลัก
      const { error } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', id);
        
      if (error) throw error;
      
      alert('ลบสินค้าสำเร็จ');
      setProducts(products.filter(p => p.id !== id));
    } catch (error: any) {
      console.error('Error deleting product:', error.message);
      alert(`ไม่สามารถลบสินค้าได้ เนื่องจากอาจมีข้อมูลผูกอยู่กับสาขาหรือออเดอร์`);
    }
  };

  // ฟังก์ชันดาวน์โหลดข้อมูลปัจจุบัน (Export) สำหรับนำไปแก้ไขและอัปเดต
  const handleExport = () => {
    const exportData = products.map(p => {
      const cat = categories.find(c => c.id === p.category_id);
      return {
        ID: p.id,
        Name: p.name,
        Description: p.description || '',
        Price: p.price,
        Category_Name: cat ? cat.name : '',
        Image_URL: p.image_url || '',
        Track_Stock: p.is_track_stock !== false ? 'Yes' : 'No'
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, `Products_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ฟังก์ชันดาวน์โหลด Template Excel
  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { 
        ID: '', // ปล่อยว่างเพื่อเพิ่มสินค้าใหม่
        Name: 'ชื่อสินค้าตัวอย่าง', 
        Description: 'รายละเอียดสินค้า', 
        Price: 150.50, 
        Image_URL: 'https://example.com/img.jpg', 
        Category_Name: 'ของใช้', 
        Initial_Stock_Per_Branch: 10,
        Track_Stock: 'Yes'
      }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products_Import');
    XLSX.writeFile(wb, 'Product_Import_Template.xlsx');
  };

  // ฟังก์ชันอัปโหลดและตรวจสอบไฟล์
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportErrors([]);
    setImportSuccessCount(0);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const errors: string[] = [];
        const productsToInsert: any[] = [];
        const productsToUpdate: any[] = [];

        // 1. Data Parsing & Validation
        for (let i = 0; i < data.length; i++) {
          const row: any = data[i];
          const rowNum = i + 2; // +2 เพราะ index เริ่ม 0 และมี Header ในแถวแรก

          const id = row.ID ? String(row.ID).trim() : null;

          if (!id && (!row.Name || String(row.Name).trim() === '')) {
            errors.push(`แถวที่ ${rowNum}: ข้อมูล "ชื่อสินค้า" ห้ามว่าง (สำหรับการเพิ่มใหม่)`);
            continue;
          }
          if (row.Price !== undefined && (isNaN(Number(row.Price)) || Number(row.Price) < 0)) {
            errors.push(`แถวที่ ${rowNum}: "ราคา" ต้องเป็นตัวเลขที่มากกว่าหรือเท่ากับ 0`);
            continue;
          }

          let category_id = undefined;
          if (row.Category_Name) {
            const cat = categories.find(c => c.name === String(row.Category_Name).trim());
            if (!cat) {
              errors.push(`แถวที่ ${rowNum}: ไม่พบประเภทสินค้า "${row.Category_Name}" ในระบบ`);
              continue;
            }
            category_id = cat.id;
          }
        
        const is_track_stock = row.Track_Stock ? String(row.Track_Stock).trim().toLowerCase() !== 'no' : true;

          if (id) {
            // โหมดอัปเดตข้อมูลเดิม (Upsert)
            const existing = products.find(p => p.id === id);
            if (!existing) {
              errors.push(`แถวที่ ${rowNum}: ไม่พบสินค้ารหัส ${id} ในระบบ (ไม่สามารถอัปเดตได้)`);
              continue;
            }
            productsToUpdate.push({
              id: id,
              name: row.Name !== undefined ? String(row.Name).trim() : existing.name,
              description: row.Description !== undefined ? String(row.Description).trim() : existing.description,
              price: row.Price !== undefined ? Number(row.Price) : existing.price,
              image_url: row.Image_URL !== undefined ? String(row.Image_URL).trim() : existing.image_url,
            category_id: category_id !== undefined ? category_id : existing.category_id,
            is_track_stock: row.Track_Stock !== undefined ? is_track_stock : existing.is_track_stock
            });
          } else {
            // โหมดเพิ่มข้อมูลใหม่ (Insert)
            const initialStock = isNaN(Number(row.Initial_Stock_Per_Branch)) ? 0 : Number(row.Initial_Stock_Per_Branch);
            productsToInsert.push({
              name: String(row.Name).trim(),
              description: row.Description ? String(row.Description).trim() : null,
              price: Number(row.Price),
              image_url: row.Image_URL ? String(row.Image_URL).trim() : null,
              category_id: category_id || null,
            _initialStock: initialStock,
            is_track_stock: is_track_stock
            });
          }
        }

        if (errors.length > 0) {
          setImportErrors(errors);
          setIsImporting(false);
          return; // หากมี Error แม้แต่แถวเดียว จะยกเลิกการนำเข้าทั้งหมดเพื่อความปลอดภัย
        }

        if (productsToInsert.length === 0 && productsToUpdate.length === 0) {
          setImportErrors(['ไม่พบข้อมูลสินค้าที่ถูกต้องในไฟล์']);
          setIsImporting(false);
          return;
        }

        // 2. อัปเดตข้อมูลเดิม (Upsert) ถ้ามีการแก้ไขมาจากไฟล์ Export
        if (productsToUpdate.length > 0) {
          const { error: updateError } = await supabase.from('products').upsert(productsToUpdate);
          if (updateError) throw updateError;
        }

        // 3. เพิ่มข้อมูลใหม่ (Insert) ถ้าในไฟล์ไม่มีระบุ ID
        if (productsToInsert.length > 0) {
          const insertPayload = productsToInsert.map(({ _initialStock, ...rest }) => rest);
          const { data: insertedProducts, error: insertError } = await supabase
            .from('products')
            .insert(insertPayload)
            .select('id');

          if (insertError) throw insertError;

          if (insertedProducts && branches.length > 0) {
            const inventoryPayload = insertedProducts.flatMap((insertedProduct, index) => {
              const initialStock = productsToInsert[index]._initialStock;
              return branches.map(branch => ({
                branch_id: branch.id,
                product_id: insertedProduct.id,
                stock_count: initialStock,
                status: initialStock > 0 ? 1 : 0
              }));
            });
            const { error: invError } = await supabase.from('branch_inventory').insert(inventoryPayload);
            if (invError) console.error("Inventory Insert Error:", invError.message);
          }
        }

        setImportSuccessCount(productsToInsert.length + productsToUpdate.length);
        fetchProducts(); // Refresh ตาราง

      } catch (err: any) {
        setImportErrors([`เกิดข้อผิดพลาดในการนำเข้า: ${err.message}`]);
      } finally {
        setIsImporting(false);
        e.target.value = ''; // Reset file input
      }
    };
    reader.readAsBinaryString(file);
  };

  const closeImportModal = () => {
    setIsImportModalOpen(false);
    setImportErrors([]);
    setImportSuccessCount(0);
  };

  const filteredProducts = selectedCategory
    ? products.filter(p => p.category_id === selectedCategory)
    : products;

  // ฟังก์ชันแยกหมวดหมู่หลักและย่อย
  const rootCategories = categories.filter(c => !c.parent_id);
  const getChildren = (parentId: string) => categories.filter(c => c.parent_id === parentId);
  const orderedCategories = rootCategories.flatMap(cat => [cat, ...getChildren(cat.id)]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-8 h-8 text-blue-600" />
            จัดการฐานข้อมูลสินค้า
          </h1>
          <p className="text-gray-500 mt-1">เพิ่ม แก้ไข หรือลบสินค้าส่วนกลางสำหรับทุกสาขา (Super Admin)</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button
            onClick={handleExport}
            className="flex-1 md:flex-none bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-5 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
          >
            <Download className="w-5 h-5" />
            ส่งออก (Excel)
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
          >
            <UploadCloud className="w-5 h-5" />
            นำเข้าข้อมูล (Excel)
          </button>
          <button
            onClick={() => openModal()}
            className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-5 h-5" />
            เพิ่มสินค้า
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      {categories.length > 0 && (
        <div className="flex overflow-x-auto gap-3 pb-4 mb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`flex-shrink-0 px-6 py-2.5 rounded-full text-sm font-semibold transition-colors border ${
              selectedCategory === null
                ? 'bg-slate-800 text-white border-slate-800 shadow-md'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            ทั้งหมด
          </button>
          {orderedCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex-shrink-0 px-6 py-2.5 rounded-full text-sm font-semibold transition-colors border ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-blue-50 hover:text-blue-700'
            }`}
          >
            {cat.parent_id ? `↳ ${cat.name}` : cat.name}
          </button>
          ))}
        </div>
      )}

      {/* Products Table/Grid */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-600">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 w-20 text-center">รูปภาพ</th>
                <th className="px-6 py-4">ข้อมูลสินค้า</th>
                <th className="px-6 py-4 text-right">ราคา (บาท)</th>
                <th className="px-6 py-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="border-b border-gray-50">
                    <td className="px-6 py-4 text-center">
                      <div className="w-12 h-12 rounded-lg bg-gray-200 animate-pulse mx-auto"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded-md w-3/4 mb-2 animate-pulse"></div>
                      <div className="h-3 bg-gray-100 rounded-md w-1/2 animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end">
                      <div className="h-4 bg-gray-200 rounded-md w-16 animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <div className="w-8 h-8 bg-gray-200 rounded-lg animate-pulse"></div>
                        <div className="w-8 h-8 bg-gray-200 rounded-lg animate-pulse"></div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <Package className="w-12 h-12 text-gray-300 mb-2" />
                      <p>ยังไม่มีข้อมูลสินค้าในระบบ</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-center">
                      <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center mx-auto">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900">{product.name}</p>
                      <p className="text-xs text-gray-500 line-clamp-1 mt-1">{product.description || '-'}</p>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-blue-600">
                      ฿{product.price.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleDisableGlobally(product.id, product.name)} className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="ระงับการขายทุกสาขา">
                          <PowerOff className="w-4 h-4" />
                        </button>
                        <button onClick={() => openModal(product)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="แก้ไขสินค้า">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(product.id, product.name)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="ลบสินค้า">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800">{editingId ? 'แก้ไขข้อมูลสินค้า' : 'เพิ่มสินค้าใหม่'}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-200" title="ปิดหน้าต่าง">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 overflow-y-auto flex-grow flex flex-col gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">ชื่อสินค้า <span className="text-red-500">*</span></label><input required type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="เช่น น้ำดื่มขวด 1.5 ลิตร" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label><textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none" placeholder="คำอธิบายสินค้า..." /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">ราคา (บาท) <span className="text-red-500">*</span></label><input required type="number" step="0.01" min="0" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="เช่น 15.50" /></div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รูปภาพสินค้า</label>
                <div className="flex gap-2">
                  <input type="url" value={formData.image_url} onChange={(e) => setFormData({...formData, image_url: e.target.value})} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="https://... หรืออัปโหลดไฟล์" />
                  <label className={`flex items-center justify-center px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-200 transition-colors ${isUploadingImage ? 'opacity-50 pointer-events-none' : ''}`}>
                    {isUploadingImage ? <Loader2 className="w-5 h-5 animate-spin text-slate-500" /> : <UploadCloud className="w-5 h-5 text-slate-600" />}
                    <span className="ml-2 text-sm font-medium text-slate-700 hidden sm:inline-block">{isUploadingImage ? 'กำลังอัปโหลด...' : 'อัปโหลด'}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploadingImage} />
                  </label>
                </div>
                {formData.image_url && (
                  <div className="mt-3 w-28 h-28 rounded-lg border border-gray-200 overflow-hidden relative bg-gray-50 flex items-center justify-center">
                    <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่สินค้า</label>
                <select id="category_id" title="เลือกหมวดหมู่สินค้า" value={formData.category_id} onChange={(e) => setFormData({...formData, category_id: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                  <option value="">-- ไม่ระบุหมวดหมู่ --</option>
                  {rootCategories.map(cat => (
                    <React.Fragment key={cat.id}>
                      <option value={cat.id} className="font-semibold text-gray-800">{cat.name}</option>
                      {getChildren(cat.id).map(child => (
                        <option key={child.id} value={child.id}>&nbsp;&nbsp;&nbsp;↳ {child.name}</option>
                      ))}
                    </React.Fragment>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center cursor-pointer gap-2 mt-2">
                  <div className="relative">
                    <input type="checkbox" className="sr-only" checked={formData.is_track_stock} onChange={(e) => setFormData({...formData, is_track_stock: e.target.checked})} />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${formData.is_track_stock ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.is_track_stock ? 'transform translate-x-4' : ''}`}></div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-800">นับสต็อกสินค้า (Track Stock)</span>
                    <span className="text-xs text-gray-500">ปิดหากเป็นสินค้าที่ไม่มีวันหมด หรือไม่ต้องการจัดการจำนวน</span>
                  </div>
                </label>
              </div>
              
              <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button type="button" onClick={closeModal} disabled={isSaving} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors">ยกเลิก</button>
                <button type="submit" disabled={isSaving} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl transition-colors shadow-sm">{isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Excel/CSV Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><FileSpreadsheet className="w-6 h-6 text-emerald-600" /> นำเข้าข้อมูลสินค้าด้วย Excel</h2>
                <p className="text-sm text-gray-500 mt-1">อัปโหลดไฟล์ข้อมูลสินค้าและสต็อกเพื่อนำเข้าพร้อมกันหลายรายการ</p>
              </div>
              <button onClick={closeImportModal} disabled={isImporting} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200 transition-colors" title="ปิดหน้าต่าง"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-6 flex flex-col gap-6">
              <div className="flex justify-between items-center bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <div className="text-sm text-blue-800">
                  <span className="font-semibold block mb-1">คำแนะนำการนำเข้า/อัปเดต:</span>
                  - <span className="font-medium">เพิ่มสินค้าใหม่:</span> ดาวน์โหลด Template และปล่อยช่อง ID ว่างไว้<br/>
                  - <span className="font-medium">อัปเดตราคา:</span> กดปุ่ม "ส่งออก (Excel)" ด้านนอก แก้ไขราคา แล้วนำมาอัปโหลดที่นี่
                </div>
                <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-4 py-2 bg-white border border-blue-200 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors shadow-sm shrink-0">
                  <Download className="w-4 h-4" /> ดาวน์โหลด Template
                </button>
              </div>

              {/* Feedback UI: Errors */}
              {importErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-red-700 font-semibold mb-2"><AlertCircle className="w-5 h-5" /> พบข้อผิดพลาดในการตรวจสอบไฟล์</div>
                  <ul className="list-disc list-inside text-sm text-red-600 space-y-1 ml-4 max-h-40 overflow-y-auto pr-2">
                    {importErrors.map((err, idx) => <li key={idx}>{err}</li>)}
                  </ul>
                </div>
              )}

              {/* Feedback UI: Success */}
              {importSuccessCount > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                  <div>
                    <h3 className="font-bold text-emerald-800">ประมวลผลข้อมูลสำเร็จ!</h3>
                    <p className="text-emerald-600 text-sm">อัปเดตข้อมูลและเพิ่มสินค้าใหม่สำเร็จทั้งหมด {importSuccessCount} รายการ</p>
                  </div>
                </div>
              )}

              {/* Upload Zone */}
              {importSuccessCount === 0 && (
                <label className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${isImporting ? 'bg-gray-50 border-gray-300' : 'bg-gray-50 border-gray-300 hover:bg-gray-100 hover:border-emerald-400 group'}`}>
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {isImporting ? <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-3" /> : <UploadCloud className="w-12 h-12 text-gray-400 group-hover:text-emerald-500 transition-colors mb-3" />}
                    <p className="mb-2 text-sm text-gray-500 font-medium">{isImporting ? 'กำลังประมวลผลข้อมูล โปรดรอสักครู่...' : <><span className="font-semibold text-emerald-600">คลิกเพื่ออัปโหลด</span> หรือลากไฟล์มาวางที่นี่</>}</p>
                    {!isImporting && <p className="text-xs text-gray-400">รองรับไฟล์ .xlsx หรือ .csv</p>}
                  </div>
                  <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} disabled={isImporting} />
                </label>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}