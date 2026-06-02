'use client';

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Package, Plus, Edit2, Trash2, X, Image as ImageIcon, UploadCloud, Download, FileSpreadsheet, AlertCircle, CheckCircle, Loader2, PowerOff, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

type Product = {
  id: string;
  sku?: string | null;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category_id: string | null;
  unit_id?: string | null;
  is_active?: boolean;
  is_track_stock?: boolean;
  branch_inventory?: { branch_id: number; status: number }[];
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
  const [units, setUnits] = useState<any[]>([]);

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSuccessCount, setImportSuccessCount] = useState<number>(0);
  const [missingMasterData, setMissingMasterData] = useState<{ categories: string[], units: string[] } | null>(null);
  const [pendingFileData, setPendingFileData] = useState<any[] | null>(null);

  // Branch Status Modal State
  const [branchStatusModal, setBranchStatusModal] = useState<{ isOpen: boolean; product: Product | null }>({ isOpen: false, product: null });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    price: '',
    image_url: '',
    category_id: '',
    unit_id: '',
    is_track_stock: true,
  });

  // Table Management State
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Product; direction: 'asc' | 'desc' } | null>(null);

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    action: 'delete' | 'disable' | null;
    id: string;
    name: string;
  }>({ isOpen: false, action: null, id: '', name: '' });
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchMasterData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMasterData = async () => {
    // ดึงหมวดหมู่ และ สาขามาเก็บไว้สำหรับการ Map ข้อมูลตอน Bulk Upload
    const { data: catData } = await supabase.from('categories').select('id, name, parent_id').order('sort_order', { ascending: true });
    if (catData) setCategories(catData);
    const { data: branchData } = await supabase.from('branches').select('id, name').order('name');
    if (branchData) setBranches(branchData);
    const { data: unitData } = await supabase.from('product_units').select('id, name').order('name');
    if (unitData) setUnits(unitData);
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, branch_inventory(branch_id, status)')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      console.error('Error fetching products:', error.message);
      toast.error('ไม่สามารถดึงข้อมูลสินค้าได้');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingId(product.id);
      setFormData({
        sku: product.sku || '',
        name: product.name || '',
        description: product.description || '',
        price: product.price ? String(product.price) : '',
        image_url: product.image_url || '',
        category_id: product.category_id || '',
        unit_id: product.unit_id || '',
        is_track_stock: product.is_track_stock !== false,
      });
    } else {
      setEditingId(null);
      setFormData({ sku: '', name: '', description: '', price: '', image_url: '', category_id: '', unit_id: '', is_track_stock: false });
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
      toast.error(`เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ: ${error.message}`);
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
        sku: formData.sku || null,
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        image_url: formData.image_url,
        category_id: formData.category_id || null,
        unit_id: formData.unit_id || null,
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

        toast.success('อัปเดตข้อมูลสินค้าสำเร็จ');
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

        toast.success('เพิ่มสินค้าใหม่และอัปเดตรายชื่อไปยังทุกสาขาสำเร็จ');
      }

      closeModal();
      fetchProducts();
    } catch (error: any) {
      console.error('Error saving product:', error.message);
      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const executeConfirmAction = async () => {
    if (!confirmModal.action || !confirmModal.id) return;
    setIsProcessingAction(true);

    try {
      if (confirmModal.action === 'delete') {
        // 1. ลบจากสต็อกของทุกสาขาก่อนเพื่อป้องกัน Foreign Key Constraint Error
        const { error: invError } = await supabase.from('branch_inventory').delete().eq('product_id', confirmModal.id);
        if (invError) throw invError;
        // 2. ซ่อนสินค้า (Soft Delete) แทนการลบออกจากตาราง products หลัก
        const { error } = await supabase.from('products').update({ is_active: false }).eq('id', confirmModal.id);
        if (error) throw error;
        toast.success('ลบสินค้าสำเร็จ');
        setProducts(products.filter(p => p.id !== confirmModal.id));
      } else if (confirmModal.action === 'disable') {
        const { error } = await supabase.from('branch_inventory').update({ status: 0 }).eq('product_id', confirmModal.id);
        if (error) throw error;
        toast.success(`ระงับการขายสินค้า "${confirmModal.name}" ในทุกสาขาเรียบร้อยแล้ว`);
        // อัปเดต State UI ทันทีไม่ต้องรอโหลดใหม่ (Optimistic Update)
        setProducts(products.map(p => 
          p.id === confirmModal.id 
            ? { ...p, branch_inventory: p.branch_inventory?.map(inv => ({ ...inv, status: 0 })) } 
            : p
        ));
      }
    } catch (error: any) {
      console.error(`Error ${confirmModal.action} product:`, error.message);
      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setIsProcessingAction(false);
      setConfirmModal({ isOpen: false, action: null, id: '', name: '' });
    }
  };

  // ฟังก์ชันสำหรับเปิด/ปิดสถานะสินค้ารายสาขาจากใน Modal
  const handleToggleBranchStatus = async (productId: string, branchId: number, currentStatus: number) => {
    const nextStatus = currentStatus === 1 ? 0 : 1;
    
    // Optimistic Update: อัปเดต UI ทันทีไม่ต้องรอโหลด
    const updateInventory = (inv: { branch_id: number; status: number }[]) => {
      const existingIdx = inv.findIndex(i => i.branch_id === branchId);
      if (existingIdx >= 0) {
        return inv.map(i => i.branch_id === branchId ? { ...i, status: nextStatus } : i);
      }
      return [...inv, { branch_id: branchId, status: nextStatus }];
    };

    setBranchStatusModal(prev => prev.product ? { ...prev, product: { ...prev.product, branch_inventory: updateInventory(prev.product.branch_inventory || []) } } : prev);
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, branch_inventory: updateInventory(p.branch_inventory || []) } : p));

    try {
      const { data: existing } = await supabase.from('branch_inventory').select('id').eq('branch_id', branchId).eq('product_id', productId).maybeSingle();
      if (existing) {
        const { error } = await supabase.from('branch_inventory').update({ status: nextStatus }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('branch_inventory').insert({ branch_id: branchId, product_id: productId, stock_count: 0, status: nextStatus });
        if (error) throw error;
      }
      toast.success(nextStatus === 1 ? 'เปิดขายที่สาขานี้แล้ว' : 'ปิดการขายที่สาขานี้แล้ว');
    } catch (error: any) {
      console.error('Error toggling branch status:', error);
      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
      fetchProducts(); // Rollback กลับถ้าเซฟไม่สำเร็จ
    }
  };

  // ฟังก์ชันดาวน์โหลดข้อมูลปัจจุบัน (Export) สำหรับนำไปแก้ไขและอัปเดต
  const handleExport = () => {
    const exportData = products.map(p => {
      const cat = categories.find(c => c.id === p.category_id);
      const unit = units.find(u => u.id === p.unit_id);
      return {
        ID: p.id,
        SKU: p.sku || '',
        Name: p.name,
        Description: p.description || '',
        Price: p.price,
        Unit_Name: unit ? unit.name : '',
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
        SKU: 'SKU-001',
        Name: 'ชื่อสินค้าตัวอย่าง', 
        Description: 'รายละเอียดสินค้า', 
        Price: 150.50, 
        Unit_Name: 'ชิ้น',
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
    setMissingMasterData(null);
    setPendingFileData(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        setPendingFileData(data);
        await processFileData(data, categories, units);

      } catch (err: any) {
        setImportErrors([`เกิดข้อผิดพลาดในการนำเข้า: ${err.message}`]);
        setIsImporting(false);
      } finally {
        e.target.value = ''; // Reset file input
      }
    };
    reader.readAsBinaryString(file);
  };

  const processFileData = async (data: any[], currentCategories: any[], currentUnits: any[]) => {
    const errors: string[] = [];
    const productsToInsert: any[] = [];
    const productsToUpdate: any[] = [];
    const missingCats = new Set<string>();
    const missingUnits = new Set<string>();

    // 1. Data Parsing & Validation
    for (let i = 0; i < data.length; i++) {
      const row: any = data[i];
      const rowNum = i + 2; // +2 เพราะ index เริ่ม 0 และมี Header ในแถวแรก

      const id = row.ID ? String(row.ID).trim() : null;
      const sku = row.SKU ? String(row.SKU).trim() : null;

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
        const catName = String(row.Category_Name).trim();
        const cat = currentCategories.find(c => c.name === catName);
        if (!cat) {
          missingCats.add(catName);
        } else {
          category_id = cat.id;
        }
      }

      let unit_id = undefined;
      if (row.Unit_Name) {
        const unitName = String(row.Unit_Name).trim();
        const unit = currentUnits.find(u => u.name === unitName);
        if (!unit) {
          missingUnits.add(unitName);
        } else {
          unit_id = unit.id;
        }
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
          sku: row.SKU !== undefined ? sku : existing.sku,
          name: row.Name !== undefined ? String(row.Name).trim() : existing.name,
          description: row.Description !== undefined ? String(row.Description).trim() : existing.description,
          price: row.Price !== undefined ? Number(row.Price) : existing.price,
          image_url: row.Image_URL !== undefined ? String(row.Image_URL).trim() : existing.image_url,
          category_id: category_id !== undefined ? category_id : existing.category_id,
          unit_id: unit_id !== undefined ? unit_id : existing.unit_id,
          is_track_stock: row.Track_Stock !== undefined ? is_track_stock : existing.is_track_stock
        });
      } else {
        // โหมดเพิ่มข้อมูลใหม่ (Insert)
        const initialStock = isNaN(Number(row.Initial_Stock_Per_Branch)) ? 0 : Number(row.Initial_Stock_Per_Branch);
        productsToInsert.push({
          sku: sku,
          name: String(row.Name).trim(),
          description: row.Description ? String(row.Description).trim() : null,
          price: Number(row.Price),
          image_url: row.Image_URL ? String(row.Image_URL).trim() : null,
          category_id: category_id || null,
          unit_id: unit_id || null,
          _initialStock: initialStock,
          is_track_stock: is_track_stock
        });
      }
    }

    if (missingCats.size > 0 || missingUnits.size > 0) {
      setMissingMasterData({
        categories: Array.from(missingCats),
        units: Array.from(missingUnits)
      });
      if (errors.length > 0) {
        setImportErrors(errors);
      }
      setIsImporting(false);
      return;
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

    try {
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
      setImportErrors([`เกิดข้อผิดพลาดในการบันทึกข้อมูล: ${err.message}`]);
    } finally {
      setIsImporting(false);
    }
  };

  const handleAutoCreateMasterData = async () => {
    if (!missingMasterData || !pendingFileData) return;
    setIsImporting(true);

    try {
      // 1. Create missing categories
      if (missingMasterData.categories.length > 0) {
        const catPayload = missingMasterData.categories.map(name => ({
          name: name,
          sort_order: 99
        }));
        const { error: catError } = await supabase.from('categories').insert(catPayload);
        if (catError) throw catError;
      }

      // 2. Create missing units
      if (missingMasterData.units.length > 0) {
        const unitPayload = missingMasterData.units.map(name => ({
          name: name,
          step_value: 1,
          min_value: 1
        }));
        const { error: unitError } = await supabase.from('product_units').insert(unitPayload);
        if (unitError) throw unitError;
      }

      // 3. Re-fetch master data
      const { data: newCatData } = await supabase.from('categories').select('id, name, parent_id').order('sort_order', { ascending: true });
      if (newCatData) setCategories(newCatData);
      
      const { data: newUnitData } = await supabase.from('product_units').select('id, name').order('name');
      if (newUnitData) setUnits(newUnitData);

      setMissingMasterData(null);
      
      // 4. Proceed with processing the file or show remaining errors
      if (importErrors.length > 0) {
        setIsImporting(false);
        toast.success('สร้าง Master Data สำเร็จ กรุณาแก้ไขข้อผิดพลาดอื่นๆ ในไฟล์และอัปโหลดใหม่อีกครั้ง');
      } else {
        await processFileData(pendingFileData, newCatData || categories, newUnitData || units);
      }

    } catch (error: any) {
      setImportErrors([`เกิดข้อผิดพลาดในการสร้างข้อมูล Master Data: ${error.message}`]);
      setIsImporting(false);
    }
  };

  const closeImportModal = () => {
    setIsImportModalOpen(false);
    setImportErrors([]);
    setImportSuccessCount(0);
    setMissingMasterData(null);
    setPendingFileData(null);
  };

  // Process Data: Filter -> Sort -> Paginate
  const processedProducts = React.useMemo(() => {
    let result = products;

    // 1. Filter by Category
    if (selectedCategory) {
      const childIds = categories.filter(c => c.parent_id === selectedCategory).map(c => c.id);
      result = result.filter(p => p.category_id === selectedCategory || (p.category_id !== null && childIds.includes(p.category_id)));
    }

    // 2. Filter by Search Query
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(lowerQuery) ||
        (p.sku && p.sku.toLowerCase().includes(lowerQuery)) ||
        (p.description && p.description.toLowerCase().includes(lowerQuery))
      );
    }

    // 3. Sort
    if (sortConfig) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        // Handle null/undefined values
        if (aVal === null || aVal === undefined) return sortConfig.direction === 'asc' ? 1 : -1;
        if (bVal === null || bVal === undefined) return sortConfig.direction === 'asc' ? -1 : 1;

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [products, selectedCategory, searchQuery, sortConfig, categories]);

  const totalItems = processedProducts.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = processedProducts.slice(startIndex, startIndex + itemsPerPage);

  const handleSort = (key: keyof Product) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof Product) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="w-4 h-4 ml-1 inline-block text-gray-400 opacity-50 group-hover:opacity-100 transition-opacity" />;
    }
    if (sortConfig.direction === 'asc') {
      return <ArrowUp className="w-4 h-4 ml-1 inline-block text-blue-600" />;
    }
    return <ArrowDown className="w-4 h-4 ml-1 inline-block text-blue-600" />;
  };

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

      {/* Toolbar: Categories & Search */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
        {/* Category Dropdown */}
        {categories.length > 0 && (
          <div className="w-full sm:w-64 shrink-0">
            <select
              title="กรองตามหมวดหมู่สินค้า"
              value={selectedCategory || ''}
              onChange={(e) => { setSelectedCategory(e.target.value || null); setCurrentPage(1); }}
              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow cursor-pointer appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 1rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.2em 1.2em`, paddingRight: `2.5rem` }}
            >
              <option value="">ทั้งหมด (ทุกหมวดหมู่)</option>
              {rootCategories.map(cat => (
                <React.Fragment key={cat.id}>
                  <option value={cat.id} className="font-semibold text-gray-900">{cat.name}</option>
                  {getChildren(cat.id).map(child => (
                    <option key={child.id} value={child.id}>&nbsp;&nbsp;&nbsp;↳ {child.name}</option>
                  ))}
                </React.Fragment>
              ))}
            </select>
          </div>
        )}

        {/* Search Input */}
        <div className="relative w-full sm:max-w-xs lg:w-80 sm:ml-auto shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อ, รหัสสินค้า, รายละเอียด..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
          />
        </div>
      </div>

      {/* Products Table/Grid */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-600">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 w-20 text-center">รูปภาพ</th>
                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 group select-none transition-colors" onClick={() => handleSort('name')}>
                  ข้อมูลสินค้า {getSortIcon('name')}
                </th>
                <th className="px-6 py-4 text-right cursor-pointer hover:bg-gray-100 group select-none transition-colors" onClick={() => handleSort('price')}>
                  ราคา (บาท) {getSortIcon('price')}
                </th>
                <th className="px-6 py-4 text-center">สถานะการขาย</th>
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
                      <div className="h-6 bg-gray-200 rounded-full w-20 mx-auto animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <div className="w-8 h-8 bg-gray-200 rounded-lg animate-pulse"></div>
                        <div className="w-8 h-8 bg-gray-200 rounded-lg animate-pulse"></div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <Package className="w-12 h-12 text-gray-300 mb-2" />
                      <p>ยังไม่มีข้อมูลสินค้าในระบบ</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product) => (
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
                      {product.sku && <p className="text-xs text-blue-600 font-mono mt-0.5">รหัส: {product.sku}</p>}
                      <p className="text-xs text-gray-500 line-clamp-1 mt-1">{product.description || '-'}</p>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-blue-600">
                      ฿{product.price.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => setBranchStatusModal({ isOpen: true, product })}
                        className="focus:outline-none hover:scale-105 active:scale-95 transition-transform"
                        title="คลิกเพื่อดูรายละเอียดแต่ละสาขา"
                      >
                        {(() => {
                          const inventory = product.branch_inventory || [];
                          const totalBranches = branches.length > 0 ? branches.length : inventory.length;
                          const activeCount = inventory.filter(inv => inv.status === 1).length;
                          
                          if (totalBranches === 0 && inventory.length === 0) {
                            return <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-medium shadow-sm block">ไม่มีข้อมูล</span>;
                          }
                          if (activeCount === 0) {
                            return <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-medium border border-red-200 shadow-sm block">ปิดขายทุกสาขา</span>;
                          }
                          if (activeCount === totalBranches) {
                            return <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium border border-emerald-200 shadow-sm block">เปิดขายทุกสาขา</span>;
                          }
                          return <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 font-medium border border-blue-200 shadow-sm block">เปิดขาย {activeCount}/{totalBranches} สาขา</span>;
                        })()}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => setConfirmModal({ isOpen: true, action: 'disable', id: product.id, name: product.name })} className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="ระงับการขายทุกสาขา">
                          <PowerOff className="w-4 h-4" />
                        </button>
                        <button onClick={() => openModal(product)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="แก้ไขสินค้า">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => setConfirmModal({ isOpen: true, action: 'delete', id: product.id, name: product.name })} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="ลบสินค้า">
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

        {/* Pagination Footer */}
        {!loading && totalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-gray-100 bg-white gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-3 text-sm text-gray-500 w-full sm:w-auto text-center sm:text-left">
              <div className="flex items-center gap-2">
                <span>แสดง</span>
                <select
                  title="จำนวนรายการต่อหน้า"
                  value={itemsPerPage}
                  onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  className="border border-gray-300 rounded-md px-2 py-1 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>รายการต่อหน้า</span>
              </div>
              <span className="hidden sm:inline-block border-l border-gray-300 h-4 mx-1"></span>
              <span>
                แสดง {startIndex + 1} ถึง {Math.min(startIndex + itemsPerPage, totalItems)} จากทั้งหมด {totalItems} รายการ
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="หน้าแรก"><ChevronsLeft className="w-5 h-5" /></button>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="หน้าก่อนหน้า"><ChevronLeft className="w-5 h-5" /></button>
              <span className="px-4 py-1.5 text-sm font-semibold text-gray-700 bg-gray-50 rounded-lg">หน้า {currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="หน้าถัดไป"><ChevronRight className="w-5 h-5" /></button>
              <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="หน้าสุดท้าย"><ChevronsRight className="w-5 h-5" /></button>
            </div>
          </div>
        )}

      {/* Confirm Action Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 flex flex-col items-center text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${confirmModal.action === 'delete' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                {confirmModal.action === 'delete' ? <Trash2 className="w-8 h-8" /> : <PowerOff className="w-8 h-8" />}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {confirmModal.action === 'delete' ? 'ยืนยันการลบสินค้า?' : 'ระงับการขายทุกสาขา?'}
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                {confirmModal.action === 'delete' ? (
                  <>คุณแน่ใจหรือไม่ว่าต้องการลบสินค้า <span className="font-semibold text-gray-800">"{confirmModal.name}"</span> ?<br />ข้อมูลสต็อกที่ผูกกับสาขาต่างๆ จะถูกลบทิ้งทั้งหมดและไม่สามารถกู้คืนได้</>
                ) : (
                  <>ยืนยันการระงับการขายสินค้า <span className="font-semibold text-gray-800">"{confirmModal.name}"</span> ในทุกสาขาใช่หรือไม่? สถานะสินค้าในทุกสาขาจะถูกเปลี่ยนเป็นปิดการขายทันที</>
                )}
              </p>
              
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setConfirmModal({ isOpen: false, action: null, id: '', name: '' })}
                  disabled={isProcessingAction}
                  className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={executeConfirmAction}
                  disabled={isProcessingAction}
                  className={`flex-1 px-4 py-2.5 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 ${
                    confirmModal.action === 'delete' 
                      ? 'bg-red-600 hover:bg-red-700 text-white' 
                      : 'bg-orange-600 hover:bg-orange-700 text-white'
                  }`}
                >
                  {isProcessingAction ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> กำลังดำเนินการ...</>
                  ) : (
                    <>{confirmModal.action === 'delete' ? 'ลบสินค้า' : 'ระงับการขาย'}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Branch Status Modal */}
      {branchStatusModal.isOpen && branchStatusModal.product && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-800 text-lg line-clamp-1 flex-1 pr-4" title={branchStatusModal.product.name}>
                สถานะ: {branchStatusModal.product.name}
              </h3>
              <button onClick={() => setBranchStatusModal({ isOpen: false, product: null })} className="text-gray-400 hover:text-gray-600 transition-colors p-1 bg-white rounded-md hover:bg-gray-100" title="ปิดหน้าต่าง">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full">
              {branches.length === 0 ? (
                <p className="text-center text-gray-500 py-8">ไม่มีข้อมูลสาขาในระบบ</p>
              ) : (
                <ul className="space-y-2.5">
                  {branches.map(branch => {
                    const inventory = branchStatusModal.product!.branch_inventory || [];
                    const branchInv = inventory.find(inv => inv.branch_id === branch.id);
                    const isActive = branchInv && branchInv.status === 1;

                    return (
                      <li key={branch.id} className="flex justify-between items-center p-3.5 rounded-xl border border-gray-100 bg-white shadow-sm">
                        <span className="font-medium text-gray-700 flex items-center gap-2">{branch.name}</span>
                        <span className={`px-3 py-1 text-xs font-bold rounded-full border ${isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                          {isActive ? '🟢 เปิดขาย' : '🔴 ปิดขาย'}
                        </span>
                        <label className="flex items-center cursor-pointer gap-2">
                          <div className="relative">
                            <input type="checkbox" className="sr-only" checked={isActive} onChange={() => handleToggleBranchStatus(branchStatusModal.product!.id, branch.id, isActive ? 1 : 0)} />
                            <div className={`block w-10 h-6 rounded-full transition-colors ${isActive ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isActive ? 'transform translate-x-4' : ''}`}></div>
                          </div>
                          <span className={`text-xs font-bold w-16 text-right ${isActive ? 'text-emerald-600' : 'text-gray-500'}`}>{isActive ? 'เปิดขาย' : 'ปิดการขาย'}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">รหัสสินค้า (SKU)</label>
                  <input type="text" value={formData.sku} onChange={(e) => setFormData({...formData, sku: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="เช่น SKU-001" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อสินค้า <span className="text-red-500">*</span></label>
                  <input required type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="เช่น น้ำดื่มขวด 1.5 ลิตร" />
                </div>
              </div>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <label htmlFor="unit_id" className="block text-sm font-medium text-gray-700 mb-1">หน่วยนับ</label>
                  <select id="unit_id" title="เลือกหน่วยนับ" value={formData.unit_id} onChange={(e) => setFormData({...formData, unit_id: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                    <option value="">-- ไม่ระบุหน่วยนับ --</option>
                    {units.map(unit => (
                      <option key={unit.id} value={unit.id} className="font-semibold text-gray-800">{unit.name}</option>
                    ))}
                  </select>
                </div>
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

              {/* Feedback UI: Missing Master Data Prompt */}
              {missingMasterData && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-amber-700 font-semibold mb-2"><AlertCircle className="w-5 h-5" /> พบข้อมูล Master Data ที่ไม่มีในระบบ</div>
                  <p className="text-sm text-amber-600 mb-3">คุณต้องการสร้างข้อมูลเหล่านี้อัตโนมัติ{importErrors.length === 0 ? 'และดำเนินการนำเข้าต่อ' : ''}หรือไม่?</p>
                  
                  <div className="flex flex-col gap-2 mb-4 text-sm text-amber-700">
                    {missingMasterData.categories.length > 0 && (
                      <div><strong>หมวดหมู่ที่ขาด:</strong> {missingMasterData.categories.join(', ')}</div>
                    )}
                    {missingMasterData.units.length > 0 && (
                      <div><strong>หน่วยนับที่ขาด:</strong> {missingMasterData.units.join(', ')}</div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={handleAutoCreateMasterData}
                      disabled={isImporting}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {isImporting ? 'กำลังสร้าง...' : (importErrors.length === 0 ? 'สร้างข้อมูลอัตโนมัติและนำเข้าต่อ' : 'สร้างข้อมูลอัตโนมัติ')}
                    </button>
                    <button 
                      onClick={() => setMissingMasterData(null)}
                      disabled={isImporting}
                      className="px-4 py-2 bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 rounded-lg text-sm font-medium transition-colors"
                    >
                      ยกเลิก
                    </button>
                  </div>
                </div>
              )}

              {/* Upload Zone */}
              {importSuccessCount === 0 && !missingMasterData && (
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