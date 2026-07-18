import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest"
import BuyerHomepage from "../../../components/buyer/BuyerHomepage"
import { MemoryRouter } from "react-router-dom"

// Mock config
vi.mock("../../../config", () => ({
  default: {
    API_BASE_URL: "http://test-api"
  }
}))

// Mock Cart Context
const addItemMock = vi.fn()

vi.mock("../../../contexts/CartContext", () => ({
  useCart: () => ({
    addItem: addItemMock
  })
}))

// Mock data
const mockItems = Array.from({ length: 20 }).map((_, i) => ({
  id: i + 1,
  brand: "Toyota",
  category: "Engine",
  vehicle_type: "Car",
  buying_price: 1000 + i,
  discount_percentage: 10 + i,
  image: "test.jpg"
}))

// Render helper
const renderComponent = () => {
  return render(
    <MemoryRouter>
      <BuyerHomepage />
    </MemoryRouter>
  )
}

// Fetch helpers
const mockFetchSuccess = (items = mockItems) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items })
      })
    )
  )
}

const mockFetchFail = () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: false
      })
    )
  )
}

describe("Buyer APIs (BuyerHomePage)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it("fetches and renders spare parts", async () => {
    mockFetchSuccess()

    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText(/Toyota Engine/i).length).toBeGreaterThan(0)
    })
  })

  it("handles API error", async () => {
    mockFetchFail()

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
    })
  })

  it("retries fetching on button click", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: mockItems })
      })

    vi.stubGlobal("fetch", fetchMock)

    renderComponent()

    const retryBtn = await screen.findByText(/Retry/i)
    fireEvent.click(retryBtn)

    await waitFor(() => {
      expect(screen.getAllByText(/Toyota Engine/i).length).toBeGreaterThan(0)
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("adds item to cart", async () => {
    mockFetchSuccess()

    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText(/Add To Cart/i).length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getAllByText(/Add To Cart/i)[0])

    expect(addItemMock).toHaveBeenCalled()
  })

  it("handles empty API response", async () => {
    mockFetchSuccess([])

    renderComponent()

    await waitFor(() => {
      expect(screen.queryAllByText(/Add To Cart/i).length).toBe(0)
    })
  })
})