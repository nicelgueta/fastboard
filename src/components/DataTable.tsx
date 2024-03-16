import React from "react";
import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableCaption,
} from "@chakra-ui/react";

interface DataTableProps {
  data: any[]; 
  columns: string[];
  caption?: string;
}

const DataTable: React.FC<DataTableProps> = ({ 
    data, columns, caption
}) => {
  return (
    <Table variant="striped" colorScheme="teal">
        {
            caption && <TableCaption placement="top">{caption}</TableCaption>
        }
      <Thead>
        <Tr>
          {columns.map((column, index) => (
            <Th key={index}>{column}</Th>
          ))}
        </Tr>
      </Thead>
      <Tbody>
        {data.map((row, rowIndex) => (
          <Tr key={rowIndex}>
            {columns.map((column, colIndex) => (
              <Td key={colIndex}>{row[column]}</Td>
            ))}
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
};

export default DataTable;
