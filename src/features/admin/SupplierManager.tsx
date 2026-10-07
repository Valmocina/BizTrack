import { useState, type FormEvent } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { useLoad } from "@/hooks/useLoad";
import { formatPrice } from "@/services/format";
import { 
  listSuppliers, 
  linkProductToSupplier, 
  removeProductFromSupplier, 
  deleteSupplier, 
  addSupplier 
} from "@/services/supplierService";
import { listProducts, createProduct } from "@/services/productService";
import type { Notify, Supplier, Product } from "@/types";

type NewProductLink = {
  productId?: string;
  isNewProduct?: boolean;
  productName: string;
  unitPrice: number;
};

export function SupplierManager({ notify, canEdit }: { notify: Notify; canEdit: boolean }) {
  const suppliers = useLoad(listSuppliers, [] as Supplier[], notify, "suppliers");
  const products = useLoad(listProducts, [] as Product[], notify, "products");

  // Edit existing supplier's products state
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isCreatingCustomInEdit, setIsCreatingCustomInEdit] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [customEditProdName, setCustomEditProdName] = useState<string>("");
  const [unitPrice, setUnitPrice] = useState<number | string>("");

  // Add new supplier state
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCategory, setNewCategory] = useState("General");
  
  // Staging products while creating a new supplier
  const [newSupplierProducts, setNewSupplierProducts] = useState<NewProductLink[]>([]);
  const [isCreatingCustomProduct, setIsCreatingCustomProduct] = useState(false);
  const [addProdId, setAddProdId] = useState("");
  const [customProdName, setCustomProdName] = useState("");
  const [addProdPrice, setAddProdPrice] = useState<number | string>("");

  const handleStageProduct = () => {
    if (isCreatingCustomProduct) {
      if (!customProdName.trim()) return;
      if (newSupplierProducts.some((p) => p.productName.toLowerCase() === customProdName.trim().toLowerCase())) {
        notify("This product name is already in your staging list.");
        return;
      }

      setNewSupplierProducts((prev) => [
        ...prev,
        {
          isNewProduct: true,
          productName: customProdName.trim(),
          unitPrice: Number(addProdPrice) || 0,
        },
      ]);
      setCustomProdName("");
    } else {
      if (!addProdId) return;
      const foundProduct = products.data.find((p) => p.id === addProdId);
      if (!foundProduct) return;

      if (newSupplierProducts.some((p) => p.productId === addProdId)) {
        notify("This product is already added to the list.");
        return;
      }

      setNewSupplierProducts((prev) => [
        ...prev,
        {
          productId: addProdId,
          productName: foundProduct.name,
          unitPrice: Number(addProdPrice) || 0,
        },
      ]);
      setAddProdId("");
    }

    setAddProdPrice("");
  };

  const handleUnstageProduct = (index: number) => {
    setNewSupplierProducts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateSupplier = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await addSupplier({
        name: newName,
        contactEmail: newEmail,
        category: newCategory,
        initialProducts: newSupplierProducts,
      });
      notify("Supplier and offered products saved successfully.");
      setIsAdding(false);
      setNewName("");
      setNewEmail("");
      setNewCategory("General");
      setNewSupplierProducts([]);
      await suppliers.reload();
      await products.reload();
    } catch (error) {
      notify(`Could not add supplier: ${(error as Error).message}`);
    }
  };

  const handleDeleteSupplier = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete ${name}? This will also remove their linked products.`)) return;
    try {
      await deleteSupplier(id);
      notify("Supplier deleted successfully.");
      await suppliers.reload();
    } catch (error) {
      notify(`Could not delete supplier: ${(error as Error).message}`);
    }
  };

  const handleAddProduct = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingSupplier) return;

    try {
      let targetProductId = selectedProductId;

      // If creating a brand new custom product inside Manage Offered Products
      if (isCreatingCustomInEdit) {
        if (!customEditProdName.trim()) return;

        // 1. Create the product and capture its new ID directly from Supabase
        const newProduct = await createProduct({
          name: customEditProdName.trim(),
          category: editingSupplier.category || "General",
          description: `Supplied by ${editingSupplier.name}`,
          price: Number(unitPrice) || 0,
          stock: 0,
          lowStockAlert: 5,
        });

        targetProductId = newProduct.id;
      }

      if (!targetProductId) return;

      // 2. Link the newly created product ID directly to the supplier
      await linkProductToSupplier({
        supplierId: editingSupplier.id,
        productId: targetProductId,
        unitPrice: Number(unitPrice), 
      });

      notify("Product created and assigned to supplier successfully.");
      
      // 3. Reset form state
      setSelectedProductId("");
      setCustomEditProdName("");
      setUnitPrice(""); 
      setIsCreatingCustomInEdit(false);
      
      // 4. Reload lists to reflect the updates across the UI
      await products.reload();
      await suppliers.reload();

    } catch (error) {
      notify(`Could not assign product: ${(error as Error).message}`);
    }
  };
  
  const handleRemoveProduct = async (spId: string) => {
    try {
      await removeProductFromSupplier(spId);
      notify("Product removed from supplier.");
      await suppliers.reload();
      
      if (editingSupplier) {
        setEditingSupplier({
          ...editingSupplier,
          products: editingSupplier.products?.filter((p) => p.id !== spId),
        });
      }
    } catch (error) {
      notify(`Could not remove product: ${(error as Error).message}`);
    }
  };

  const rows = suppliers.data.map((s) => [
    s.name,
    s.contactEmail,
    s.category,
    s.products && s.products.length > 0 ? (
      <div className="flex flex-wrap gap-1">
        {s.products.map((p) => (
          <span key={p.id} className="inline-block bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded">
            {p.productName} ({formatPrice(p.unitPrice)})
          </span>
        ))}
      </div>
    ) : (
      <span className="text-slate-400">No products linked</span>
    ),
    canEdit ? (
      <div className="flex items-center gap-2">
        <button
          className="btn-secondary !h-8 !px-2.5 text-xs flex items-center gap-1"
          onClick={() => {
            setEditingSupplier(s);
            setIsCreatingCustomInEdit(false);
            setCustomEditProdName("");
            setSelectedProductId("");
          }}
        >
          <Icon name="edit" size={14} /> Manage Products
        </button>
        <button
          className="btn-secondary !h-8 !px-2.5 text-xs flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          onClick={() => handleDeleteSupplier(s.id, s.name)}
          title="Delete Supplier"
        >
          <Icon name="trash" size={14} />
        </button>
      </div>
    ) : null,
  ]);

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h1 className="page-title">Suppliers ({suppliers.data.length})</h1>
        {canEdit && (
          <button 
            className={`flex items-center gap-2 ${
              isAdding 
                ? "btn-secondary !bg-red-50 !text-red-600 hover:!bg-red-100 border-red-200" 
                : "btn-primary"
            }`} 
            onClick={() => setIsAdding(!isAdding)}
          >
            <Icon name={isAdding ? "close" : "plus"} size={16} /> 
            {isAdding ? "Cancel" : "Add Supplier"}
          </button>
        )}
      </div>

      {/* Add Supplier Form */}
      {isAdding && (
        <div className="card p-5 space-y-5 border-2 border-emerald-500">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-lg">Add New Supplier</h2>
            <button 
              type="button" 
              className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50" 
              onClick={() => setIsAdding(false)}
              title="Cancel"
            >
              <Icon name="close" size={20} />
            </button>
          </div>
          
          <form onSubmit={handleCreateSupplier} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="field">
                <span>Supplier Name</span>
                <input type="text" required value={newName} onChange={(e) => setNewName(e.target.value)} />
              </label>
              <label className="field">
                <span>Contact Email</span>
                <input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              </label>
              <label className="field">
                <span>Category</span>
                <input type="text" required value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
              </label>
            </div>

            {/* Offered Products Subsection */}
            <div className="pt-3 border-t space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-700">Offered Products (Optional)</h3>
                
                {/* Mode Selector Buttons */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={!isCreatingCustomProduct ? "btn-primary !h-8 !px-3 text-xs" : "btn-secondary !h-8 !px-3 text-xs"}
                    onClick={() => setIsCreatingCustomProduct(false)}
                  >
                    Select Existing
                  </button>
                  <button
                    type="button"
                    className={isCreatingCustomProduct ? "btn-primary !h-8 !px-3 text-xs" : "btn-secondary !h-8 !px-3 text-xs"}
                    onClick={() => setIsCreatingCustomProduct(true)}
                  >
                    + Create New Product
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 items-end bg-slate-50 p-3 rounded border">
                {isCreatingCustomProduct ? (
                  <label className="field">
                    <span>New Product Name</span>
                    <input
                      type="text"
                      placeholder="e.g., Gaming Laptop RTX 4070"
                      value={customProdName}
                      onChange={(e) => setCustomProdName(e.target.value)}
                    />
                  </label>
                ) : (
                  <label className="field">
                    <span>Select Product</span>
                    <select
                      value={addProdId}
                      onChange={(e) => setAddProdId(e.target.value)}
                    >
                      <option value="">Choose a product</option>
                      {products.data.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="field">
                  <span>Unit Price</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={addProdPrice}
                    onChange={(e) => setAddProdPrice(e.target.value)}
                  />
                </label>

                <button
                  type="button"
                  className="btn-secondary !h-10 flex items-center justify-center gap-1"
                  onClick={handleStageProduct}
                  disabled={isCreatingCustomProduct ? !customProdName.trim() : !addProdId}
                >
                  <Icon name="plus" size={16} /> {isCreatingCustomProduct ? "Add New Product" : "Add to Supplier List"}
                </button>
              </div>

              {/* Staged Products List */}
              {newSupplierProducts.length > 0 && (
                <div className="mt-3 divide-y border rounded bg-white">
                  {newSupplierProducts.map((p, index) => (
                    <div key={index} className="p-2.5 flex justify-between items-center text-sm">
                      <div>
                        <span className="font-medium">{p.productName}</span>
                        {p.isNewProduct && (
                          <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                            NEW PRODUCT
                          </span>
                        )}
                        <span className="text-slate-500 ml-3">Unit Price: {formatPrice(p.unitPrice)}</span>
                      </div>
                      <button
                        type="button"
                        className="text-red-600 hover:text-red-800 p-1"
                        onClick={() => handleUnstageProduct(index)}
                        title="Remove"
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button 
                type="button" 
                className="btn-secondary !bg-red-50 !text-red-600 hover:!bg-red-100 border-red-200 !h-10 px-6"
                onClick={() => setIsAdding(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary !h-10 px-6">
                Save Supplier
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Products Modal / Section */}
      {editingSupplier && (
        <div className="card p-5 space-y-4 border-2 border-primary-500">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-lg">Manage Offered Products: {editingSupplier.name}</h2>
            <button 
              className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50" 
              onClick={() => setEditingSupplier(null)}
              title="Close"
            >
              <Icon name="close" size={20} />
            </button>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={!isCreatingCustomInEdit ? "btn-primary !h-8 !px-3 text-xs" : "btn-secondary !h-8 !px-3 text-xs"}
              onClick={() => setIsCreatingCustomInEdit(false)}
            >
              Select Existing
            </button>
            <button
              type="button"
              className={isCreatingCustomInEdit ? "btn-primary !h-8 !px-3 text-xs" : "btn-secondary !h-8 !px-3 text-xs"}
              onClick={() => setIsCreatingCustomInEdit(true)}
            >
              + Create New Product
            </button>
          </div>

          <form onSubmit={handleAddProduct} className="grid gap-4 sm:grid-cols-3 items-end">
            {isCreatingCustomInEdit ? (
              <label className="field">
                <span>New Product Name</span>
                <input
                  type="text"
                  placeholder="e.g., Wireless Gaming Mouse"
                  value={customEditProdName}
                  onChange={(e) => setCustomEditProdName(e.target.value)}
                  required
                />
              </label>
            ) : (
              <label className="field">
                <span>Select Product</span>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  required
                >
                  <option value="" disabled>Choose a product</option>
                  {products.data.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="field">
              <span>Supplier's Unit Cost</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                required
              />
            </label>

            <button type="submit" className="btn-primary !h-10">
              <Icon name="plus" size={16} /> {isCreatingCustomInEdit ? "Create & Link Product" : "Link Product"}
            </button>
          </form>

          {/* Linked Products List */}
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-slate-600 mb-2">Currently Supplied Items:</h3>
            {editingSupplier.products && editingSupplier.products.length > 0 ? (
              <div className="divide-y border rounded">
                {editingSupplier.products.map((sp) => (
                  <div key={sp.id} className="p-2.5 flex justify-between items-center text-sm">
                    <div>
                      <span className="font-medium">{sp.productName}</span>
                      <span className="text-slate-500 ml-3">Unit Price: {formatPrice(sp.unitPrice)}</span>
                    </div>
                    <button
                      type="button"
                      className="text-red-600 hover:text-red-800 p-1"
                      onClick={() => handleRemoveProduct(sp.id)}
                      title="Remove link"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No products assigned to this supplier yet.</p>
            )}
          </div>
        </div>
      )}

      <DataTable
        columns={["Supplier Name", "Contact", "Category", "Supplied Products", "Actions"]}
        rows={rows}
        loading={suppliers.loading}
        emptyText="No suppliers found."
      />
    </div>
  );
}