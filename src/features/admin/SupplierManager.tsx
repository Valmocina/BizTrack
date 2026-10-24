import { useEffect, useRef, useState, type FormEvent } from "react"
import { DataTable } from "@/components/ui/DataTable"
import { Icon } from "@/components/ui/Icon"
import { useLoad } from "@/hooks/useLoad"
import { formatPrice } from "@/services/format"
import {
  listSuppliers,
  linkProductToSupplier,
  removeProductFromSupplier,
  archiveSuppliers,
  restoreSuppliers,
  deleteArchivedSupplier,
  addSupplier,
} from "@/services/supplierService"
import { listProducts, createProduct } from "@/services/productService"
import type { Notify, Supplier, Product } from "@/types"

type NewProductLink = {
  productId?: string
  isNewProduct?: boolean
  productName: string
  unitPrice: number
}

export function SupplierManager({
  notify,
  canEdit,
}: {
  notify: Notify
  canEdit: boolean
}) {
  const suppliers = useLoad(
    listSuppliers,
    [] as Supplier[],
    notify,
    "suppliers",
  )
  const products = useLoad(listProducts, [] as Product[], notify, "products")

  // Edit existing supplier's products state
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [isCreatingCustomInEdit, setIsCreatingCustomInEdit] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<string>("")
  const [customEditProdName, setCustomEditProdName] = useState<string>("")
  const [unitPrice, setUnitPrice] = useState<number | string>("")
  const [recordView, setRecordView] = useState<"active" | "archived">("active")
  const editorRef = useRef<HTMLElement>(null)

  const activeSuppliers = suppliers.data.filter(
    (supplier) => !supplier.isArchived,
  )
  const archivedSuppliers = suppliers.data.filter(
    (supplier) => supplier.isArchived,
  )
  const visibleSuppliers =
    recordView === "active" ? activeSuppliers : archivedSuppliers
  const unlinkedProducts = products.data.filter(
    (product) => (product.isActive ?? true) && !(product.hasSupplier ?? false),
  )

  useEffect(() => {
    if (editingSupplier) {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [editingSupplier?.id])

  // Add new supplier state
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newCategory, setNewCategory] = useState("General")

  // Staging products while creating a new supplier
  const [newSupplierProducts, setNewSupplierProducts] =
    useState<NewProductLink[]>([])
  const [isCreatingCustomProduct, setIsCreatingCustomProduct] = useState(false)
  const [addProdId, setAddProdId] = useState("")
  const [customProdName, setCustomProdName] = useState("")
  const [addProdPrice, setAddProdPrice] = useState<number | string>("")

  const handleStageProduct = () => {
    if (isCreatingCustomProduct) {
      if (!customProdName.trim()) return
      if (
        newSupplierProducts.some(
          (p) =>
            p.productName.toLowerCase() === customProdName.trim().toLowerCase(),
        )
      ) {
        notify("This product name is already in your staging list.")
        return
      }

      setNewSupplierProducts((prev) => [
        ...prev,
        {
          isNewProduct: true,
          productName: customProdName.trim(),
          unitPrice: Number(addProdPrice) || 0,
        },
      ])
      setCustomProdName("")
    } else {
      if (!addProdId) return
      const foundProduct = products.data.find((p) => p.id === addProdId)
      if (!foundProduct) return
      if (foundProduct.hasSupplier) {
        notify("This product is already linked to a supplier.")
        return
      }

      if (newSupplierProducts.some((p) => p.productId === addProdId)) {
        notify("This product is already added to the list.")
        return
      }

      setNewSupplierProducts((prev) => [
        ...prev,
        {
          productId: addProdId,
          productName: foundProduct.name,
          unitPrice: Number(addProdPrice) || 0,
        },
      ])
      setAddProdId("")
    }

    setAddProdPrice("")
  }

  const handleUnstageProduct = (index: number) => {
    setNewSupplierProducts((prev) => prev.filter((_, i) => i !== index))
  }

  const handleCreateSupplier = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await addSupplier({
        name: newName,
        contactEmail: newEmail,
        category: newCategory,
        initialProducts: newSupplierProducts,
      })
      notify("Supplier and offered products saved successfully.")
      setIsAdding(false)
      setNewName("")
      setNewEmail("")
      setNewCategory("General")
      setNewSupplierProducts([])
      await suppliers.reload()
      await products.reload()
    } catch (error) {
      notify(`Could not add supplier: ${(error as Error).message}`)
    }
  }

  const handleArchiveSuppliers = async () => {
    if (
      !window.confirm(
        `Archive these ${visibleSuppliers.length} suppliers? You can restore them from the Archived tab.`,
      )
    )
      return
    try {
      await archiveSuppliers(visibleSuppliers.map((supplier) => supplier.id))
      notify("Suppliers archived successfully.")
      await suppliers.reload()
    } catch (error) {
      notify(`Could not archive suppliers: ${(error as Error).message}`)
    }
  }

  const handleRestoreSuppliers = async () => {
    try {
      await restoreSuppliers(visibleSuppliers.map((supplier) => supplier.id))
      notify("Suppliers restored successfully.")
      await suppliers.reload()
    } catch (error) {
      notify(`Could not restore suppliers: ${(error as Error).message}`)
    }
  }

  const handleArchiveSupplier = async (id: string, name: string) => {
    if (!window.confirm(`Archive ${name}? You can restore it later.`)) return
    try {
      await archiveSuppliers([id])
      await suppliers.reload()
      notify(`${name} archived.`)
    } catch (error) {
      notify(`Could not archive supplier: ${(error as Error).message}`)
    }
  }

  const handleRestoreSupplier = async (id: string, name: string) => {
    try {
      await restoreSuppliers([id])
      await suppliers.reload()
      notify(`${name} restored.`)
    } catch (error) {
      notify(`Could not restore supplier: ${(error as Error).message}`)
    }
  }

  const handleDeleteArchivedSupplier = async (id: string, name: string) => {
    if (
      !window.confirm(
        `Permanently delete archived supplier ${name}? This cannot be undone. Its supplier-product links will also be deleted.`,
      )
    )
      return
    try {
      await deleteArchivedSupplier(id)
      notify("Archived supplier permanently deleted.")
      await suppliers.reload()
    } catch (error) {
      notify(
        `Could not permanently delete supplier: ${(error as Error).message}`,
      )
    }
  }

  const handleAddProduct = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingSupplier) return

    try {
      let targetProductId = selectedProductId

      // If creating a brand new custom product inside Manage Offered Products
      if (isCreatingCustomInEdit) {
        if (!customEditProdName.trim()) return

        // 1. Create the product and capture its new ID directly from Supabase
        const newProduct = await createProduct({
          name: customEditProdName.trim(),
          category: editingSupplier.category || "General",
          description: `Supplied by ${editingSupplier.name}`,
          price: Number(unitPrice) || 0,
          stock: 0,
          lowStockAlert: 5,
        })

        targetProductId = newProduct.id
        targetProductId = newProduct.id
        const selectedProduct = unlinkedProducts.find(
          (product) => product.id === selectedProductId,
        )
        if (!selectedProduct) {
          notify("Choose a product that is not linked to another supplier.")
          await products.reload()
          return
        }
      }

      if (!targetProductId) return

      // 2. Link the newly created product ID directly to the supplier
      await linkProductToSupplier({
        supplierId: editingSupplier.id,
        productId: targetProductId,
        unitPrice: Number(unitPrice),
      })

      notify("Product created and assigned to supplier successfully.")

      // 3. Reset form state
      setSelectedProductId("")
      setCustomEditProdName("")
      setUnitPrice("")
      setIsCreatingCustomInEdit(false)

      // 4. Reload lists to reflect the updates across the UI
      await products.reload()
      await suppliers.reload()
    } catch (error) {
      notify(`Could not assign product: ${(error as Error).message}`)
    }
  }

  const handleRemoveProduct = async (spId: string) => {
    try {
      await removeProductFromSupplier(spId)
      notify("Product removed from supplier.")
      await suppliers.reload()

      if (editingSupplier) {
        setEditingSupplier({
          ...editingSupplier,
          products: editingSupplier.products?.filter((p) => p.id !== spId),
        })
      }
    } catch (error) {
      notify(`Could not remove product: ${(error as Error).message}`)
    }
  }

  const rows = visibleSuppliers.map((s) => [
    <span className="font-semibold text-slate-900">{s.name}</span>,
    s.contactEmail || <span className="text-slate-500">No contact email</span>,
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
      {s.category}
    </span>,
    s.products && s.products.length > 0 ? (
      <div className="flex flex-wrap gap-1.5">
        {s.products.map((p) => (
          <span
            key={p.id}
            className="inline-flex rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800"
          >
            {p.productName}{" "}
            <span className="ml-1 text-blue-700">
              {formatPrice(p.unitPrice)}
            </span>
          </span>
        ))}
      </div>
    ) : (
      <span className="text-sm text-slate-500">No linked products</span>
    ),
    canEdit ? (
      <div className="flex items-center gap-2 whitespace-nowrap">
        {recordView === "active" ? (
          <>
            <button
              className="btn-secondary !h-9 !px-3 text-xs flex items-center gap-1.5"
              onClick={() => {
                setEditingSupplier(s)
                setIsCreatingCustomInEdit(false)
                setCustomEditProdName("")
                setSelectedProductId("")
              }}
            >
              <Icon name="edit" size={14} /> Manage Products
            </button>
            <button
              className="btn-secondary !h-9 !px-3 text-xs flex items-center gap-1.5 text-amber-700"
              onClick={() => handleArchiveSupplier(s.id, s.name)}
              title={`Archive ${s.name}`}
            >
              Archive
            </button>
          </>
        ) : (
          <>
            <button
              className="btn-secondary !h-9 !px-3 text-xs"
              onClick={() => handleRestoreSupplier(s.id, s.name)}
            >
              Restore
            </button>
            <button
              className="btn-secondary !h-9 !px-3 text-xs flex items-center gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              onClick={() => handleDeleteArchivedSupplier(s.id, s.name)}
              title="Permanently delete supplier"
            >
              <Icon name="trash" size={14} /> Delete
            </button>
          </>
        )}
      </div>
    ) : null,
  ])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 className="page-title">Suppliers</h1>
          <p className="page-description">
            Manage supplier contacts and the products they provide.
          </p>
        </div>
        {canEdit && recordView === "active" && (
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

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex overflow-hidden rounded-md border border-[#e5ebf3] bg-white">
          {(["active", "archived"] as const).map((view) => (
            <button
              key={view}
              type="button"
              aria-pressed={recordView === view}
              onClick={() => {
                setRecordView(view)
                setEditingSupplier(null)
              }}
              className={`px-4 py-2 text-sm font-semibold transition ${
                recordView === view
                  ? "bg-slate-800 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {view === "active" ? "Active" : "Archived"} (
              {view === "active"
                ? activeSuppliers.length
                : archivedSuppliers.length}
              )
            </button>
          ))}
        </div>
        {canEdit &&
          visibleSuppliers.length > 0 &&
          (recordView === "active" ? (
            <button
              className="btn-secondary !h-10"
              onClick={handleArchiveSuppliers}
            >
              Archive ({visibleSuppliers.length})
            </button>
          ) : (
            <button
              className="btn-secondary !h-10"
              onClick={handleRestoreSuppliers}
            >
              Restore ({visibleSuppliers.length})
            </button>
          ))}
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
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Contact Email</span>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Category</span>
                <input
                  type="text"
                  required
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                />
              </label>
            </div>

            {/* Offered Products Subsection */}
            <div className="pt-3 border-t space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-700">
                  Offered Products (Optional)
                </h3>

                {/* Mode Selector Buttons */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={
                      !isCreatingCustomProduct
                        ? "btn-primary !h-8 !px-3 text-xs"
                        : "btn-secondary !h-8 !px-3 text-xs"
                    }
                    onClick={() => setIsCreatingCustomProduct(false)}
                  >
                    Select Existing
                  </button>
                  <button
                    type="button"
                    className={
                      isCreatingCustomProduct
                        ? "btn-primary !h-8 !px-3 text-xs"
                        : "btn-secondary !h-8 !px-3 text-xs"
                    }
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
                      {unlinkedProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    {unlinkedProducts.length === 0 && (
                      <span className="text-sm text-slate-600">
                        No unlinked products available.
                      </span>
                    )}
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
                  disabled={
                    isCreatingCustomProduct
                      ? !customProdName.trim()
                      : !addProdId
                  }
                >
                  <Icon name="plus" size={16} />{" "}
                  {isCreatingCustomProduct
                    ? "Add New Product"
                    : "Add to Supplier List"}
                </button>
              </div>

              {/* Staged Products List */}
              {newSupplierProducts.length > 0 && (
                <div className="mt-3 divide-y border rounded bg-white">
                  {newSupplierProducts.map((p, index) => (
                    <div
                      key={index}
                      className="p-2.5 flex justify-between items-center text-sm"
                    >
                      <div>
                        <span className="font-medium">{p.productName}</span>
                        {p.isNewProduct && (
                          <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                            NEW PRODUCT
                          </span>
                        )}
                        <span className="text-slate-500 ml-3">
                          Unit Price: {formatPrice(p.unitPrice)}
                        </span>
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

      <DataTable
        columns={[
          "Supplier",
          "Contact email",
          "Category",
          "Products supplied",
          "Actions",
        ]}
        rows={rows}
        loading={suppliers.loading}
        minWidth={1050}
        emptyText={`No ${recordView} suppliers found.`}
      />

      {editingSupplier && recordView === "active" && (
        <section ref={editorRef} className="card scroll-mt-4 overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                Supplier details
              </p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">
                Products supplied by {editingSupplier.name}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Link existing products or create a new product for this
                supplier.
              </p>
            </div>
            <button
              className="btn-secondary !h-9 !px-3 text-sm"
              onClick={() => setEditingSupplier(null)}
              aria-label="Close supplier product details"
            >
              <Icon name="close" size={16} /> Close
            </button>
          </div>

          <div className="space-y-5 p-5">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={
                  !isCreatingCustomInEdit
                    ? "btn-primary !h-10 !px-4 text-sm"
                    : "btn-secondary !h-10 !px-4 text-sm"
                }
                onClick={() => setIsCreatingCustomInEdit(false)}
              >
                Choose existing product
              </button>
              <button
                type="button"
                className={
                  isCreatingCustomInEdit
                    ? "btn-primary !h-10 !px-4 text-sm"
                    : "btn-secondary !h-10 !px-4 text-sm"
                }
                onClick={() => setIsCreatingCustomInEdit(true)}
              >
                <Icon name="plus" size={15} /> Create new product
              </button>
            </div>

            <form
              onSubmit={handleAddProduct}
              className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3 items-end"
            >
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
                  <span>Product</span>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Choose a product
                    </option>
                    {unlinkedProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {unlinkedProducts.length === 0 && (
                    <span className="text-sm text-slate-600">
                      No unlinked products available.
                    </span>
                  )}
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

              <button type="submit" className="btn-primary !h-11">
                <Icon name="plus" size={16} />{" "}
                {isCreatingCustomInEdit ? "Create and link" : "Link product"}
              </button>
            </form>

            <div>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-800">
                  Linked products
                </h3>
                <span className="text-sm text-slate-600">
                  {editingSupplier.products?.length ?? 0} products
                </span>
              </div>
              {editingSupplier.products &&
              editingSupplier.products.length > 0 ? (
                <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
                  {editingSupplier.products.map((sp) => (
                    <div
                      key={sp.id}
                      className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800">
                          {sp.productName}
                        </p>
                        <p className="mt-0.5 text-sm text-slate-600">
                          Supplier unit cost: {formatPrice(sp.unitPrice)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary !h-9 !px-3 text-xs text-red-700 hover:bg-red-50"
                        onClick={() => handleRemoveProduct(sp.id)}
                        title={`Remove ${sp.productName} from this supplier`}
                      >
                        <Icon name="trash" size={14} /> Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
                  No products are linked to this supplier yet.
                </p>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
