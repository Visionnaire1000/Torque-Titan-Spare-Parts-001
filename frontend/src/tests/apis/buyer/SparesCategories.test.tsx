import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SedanTyres from "../../../components/buyer/categories/tyres/SedanTyres";
import { MemoryRouter } from "react-router-dom";


/* ---------------- TYPES ---------------- */
interface MockItem {
  id: number;
  brand: string;
  category: string;
  vehicle_type: string;
  buying_price: number;
  image: string;
}


interface MockResponse {
  items: MockItem[];
  pages: number;
}


/* ---------------- MOCKS ---------------- */
vi.mock("../../../config", () => ({
  default: {
    API_BASE_URL: "http://test-api",
  },
}));


const fetchMock = vi.fn();


vi.stubGlobal(
  "fetch",
  fetchMock
);


const addItemMock = vi.fn();


vi.mock("../../../contexts/CartContext", () => ({
  useCart: () => ({
    addItem: addItemMock,
  }),
}));


/* ---------------- WRAPPER ---------------- */
const renderComponent = (): void => {
  render(
    <MemoryRouter>
      <SedanTyres />
    </MemoryRouter>
  );
};


/* ---------------- TEST DATA ---------------- */
const mockData: MockResponse = {
  items: [
    {
      id: 1,
      brand: "Michelin",
      category: "tyre",
      vehicle_type: "sedan",
      buying_price: 20000,
      image: "/test.jpg",
    },
  ],
  pages: 1,
};


/* ---------------- SETUP ---------------- */
beforeEach(() => {

  vi.clearAllMocks();


  fetchMock.mockResolvedValue({
    ok: true,

    json: async (): Promise<MockResponse> =>
      mockData,
  });

});


/* ---------------- TESTS ---------------- */
describe("SedanTyres", () => {


  it("renders loading state initially", () => {

    fetchMock.mockImplementation(
      () => new Promise(() => {})
    );


    renderComponent();


    expect(
      document.querySelector(
        ".products-page"
      )
    ).toBeInTheDocument();

  });



  it("renders fetched tyres", async () => {

    renderComponent();


    expect(
      await screen.findByText(
        /michelin/i
      )
    ).toBeInTheDocument();

  });



  it("filters by brand", async () => {

    renderComponent();


    await screen.findByText(
      /michelin/i
    );


    const selects =
      screen.getAllByRole(
        "combobox"
      ) as HTMLSelectElement[];


    const brandSelect =
      selects.find((element) =>
        element
          .closest("div")
          ?.textContent
          ?.toLowerCase()
          .includes("brand")
      ) ?? selects[0];


    await waitFor(() => {

      fireEvent.change(
        brandSelect,
        {
          target: {
            value: "Michelin",
          },
        }
      );

    });


    expect(
      brandSelect.value
    ).toBe("Michelin");

  });



  it("adds item to cart", async () => {

    renderComponent();


    const button =
      await screen.findByRole(
        "button",
        {
          name: /add to cart/i,
        }
      );


    await waitFor(() => {

      fireEvent.click(button);

    });


    expect(
      addItemMock
    ).toHaveBeenCalledTimes(1);

  });



  it("shows error state when fetch fails", async () => {

    fetchMock.mockResolvedValueOnce({
      ok: false,

      json: async () => ({}),
    });


    renderComponent();


    expect(
      await screen.findByText(
        /something went wrong/i
      )
    ).toBeInTheDocument();

  });


});